import os
import time
import wave
import struct
import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.models import Project, ProcessingJob, SubtitleCue
from app.services.asr_service import load_wav_as_numpy, get_asr_service, FasterWhisperASRService
from app.services.transcription_cache import (
    compute_media_fingerprint,
    get_cached_transcription,
    set_cached_transcription,
    get_cached_cues,
    set_cached_cues,
    _build_transcription_key
)
from app.services.pipeline_orchestrator import run_pipeline_for_project

client = TestClient(app)

def create_synthetic_wav(file_path: str, duration_sec: float = 3.0):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    sample_rate = 16000
    num_samples = int(sample_rate * duration_sec)
    with wave.open(file_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        for i in range(num_samples):
            val = int(32767.0 * 0.2 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            wf.writeframes(struct.pack('<h', val))
    return file_path


def test_fast_wav_loader(tmp_path):
    wav_path = str(tmp_path / "test_loader.wav")
    create_synthetic_wav(wav_path, duration_sec=2.5)

    audio = load_wav_as_numpy(wav_path)
    assert audio is not None
    assert audio.dtype == "float32"
    assert len(audio) == int(16000 * 2.5)
    assert -1.0 <= audio.min() <= audio.max() <= 1.0


def test_transcription_caching(tmp_path):
    wav_path = str(tmp_path / "test_cache.wav")
    create_synthetic_wav(wav_path, duration_sec=2.0)

    fp = compute_media_fingerprint(wav_path)
    assert len(fp) == 24

    # Initial check: not cached
    cached = get_cached_transcription(fp, "tiny", "si", 5)
    assert cached is None

    # Store in cache
    mock_data = {
        "detected_language": "si",
        "segments": [{"start": 0.0, "end": 2.0, "text": "ආයුබෝවන්", "words": []}],
        "duration": 2.0
    }
    set_cached_transcription(fp, "tiny", "si", 5, mock_data)

    # Secondary check: cache hit
    hit = get_cached_transcription(fp, "tiny", "si", 5)
    assert hit is not None
    assert hit["detected_language"] == "si"
    assert hit["segments"][0]["text"] == "ආයුබෝවන්"

    # Segmentation cache check
    asr_key = _build_transcription_key(fp, "tiny", "si", 5)
    cues = [{"sequence_number": 1, "start_time": 0, "end_time": 2000, "source_text": "ආයුබෝවන්"}]
    set_cached_cues(asr_key, 42, 2, cues)
    cached_cues = get_cached_cues(asr_key, 42, 2)
    assert cached_cues is not None
    assert len(cached_cues) == 1


def test_pipeline_timing_telemetry_and_cache_hit(tmp_path):
    db = SessionLocal()
    try:
        # Create project and media
        proj = Project(
            title="Telemetry Benchmark Project",
            original_filename="sample.wav",
            stored_filename="sample_telemetry.wav",
            media_type="audio/wav",
            media_duration=4.0,
            file_size=128000,
            source_language="si",
            target_language="si"
        )
        db.add(proj)
        db.commit()
        db.refresh(proj)

        # Write actual wav to uploads
        media_path = settings.STORAGE_DIR / "uploads" / proj.stored_filename
        create_synthetic_wav(str(media_path), duration_sec=4.0)

        # Create job 1 (cold run)
        job1 = ProcessingJob(project_id=proj.id, status="queued")
        db.add(job1)
        db.commit()
        db.refresh(job1)

        completed_job1 = run_pipeline_for_project(
            db=db,
            project_id=proj.id,
            job_id=job1.id,
            max_chars_per_line=42,
            max_lines=2
        )
        assert completed_job1.status == "completed"
        assert completed_job1.timing_metrics is not None
        metrics1 = completed_job1.timing_metrics

        # Telemetry metrics validated
        assert "real_time_factor" in metrics1
        assert "speedup_factor" in metrics1
        assert "total_processing_ms" in metrics1
        assert metrics1["real_time_factor"] < 1.0  # Must be faster than real time

        # Run 2: Cached execution (must hit cache and be under 200ms)
        job2 = ProcessingJob(project_id=proj.id, status="queued")
        db.add(job2)
        db.commit()
        db.refresh(job2)

        t0 = time.perf_counter()
        completed_job2 = run_pipeline_for_project(
            db=db,
            project_id=proj.id,
            job_id=job2.id,
            max_chars_per_line=42,
            max_lines=2
        )
        t_cached_total = time.perf_counter() - t0

        assert completed_job2.status == "completed"
        metrics2 = completed_job2.timing_metrics
        assert metrics2["asr_cached"] is True
        assert metrics2["audio_extraction_cached"] is True
        assert t_cached_total < 0.5  # Instantaneous cache retrieval
    finally:
        db.close()


def test_duplicate_job_prevention():
    # Create project via API
    res = client.post("/api/v1/projects", json={"title": "Duplicate Prevention Test"})
    assert res.status_code == 201
    proj_id = res.json()["id"]

    db = SessionLocal()
    try:
        p = db.query(Project).filter(Project.id == proj_id).first()
        p.stored_filename = "dummy.mp4"
        media_path = settings.STORAGE_DIR / "uploads" / "dummy.mp4"
        create_synthetic_wav(str(media_path), duration_sec=2.0)
        
        # Simulate an ongoing active processing job
        active_job = ProcessingJob(
            project_id=proj_id,
            status="processing",
            current_stage="speech_recognition",
            progress=45.0,
            stage_message="Processing audio..."
        )
        db.add(active_job)
        db.commit()
        db.refresh(active_job)
        expected_job_id = active_job.id
    finally:
        db.close()

    # Trigger generation while another job is actively processing
    res = client.post(f"/api/v1/projects/{proj_id}/generate", json={"source_language": "si"})
    assert res.status_code == 200
    returned_job = res.json()

    # Must return the existing active job without spawning duplicates
    assert returned_job["id"] == expected_job_id
    assert returned_job["status"] == "processing"
