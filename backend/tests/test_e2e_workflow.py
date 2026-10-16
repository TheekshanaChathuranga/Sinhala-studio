import os
import wave
import struct
import math
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings

client = TestClient(app)

def create_synthetic_wav(file_path: str, duration_sec: float = 3.0):
    """Generate a valid 16kHz mono WAV file for testing."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    sample_rate = 16000
    num_samples = int(sample_rate * duration_sec)
    
    with wave.open(file_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        # Write a gentle 440Hz sine wave
        for i in range(num_samples):
            value = int(32767.0 * 0.3 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            data = struct.pack('<h', value)
            wav_file.writeframes(data)
    return file_path


def test_full_e2e_subtitling_workflow(tmp_path):
    # 1. Create a synthetic test audio file
    test_wav = str(tmp_path / "test_audio.wav")
    create_synthetic_wav(test_wav, duration_sec=4.0)
    assert os.path.exists(test_wav)

    # 2. Create project
    create_payload = {
        "title": "E2E Integration Test Project",
        "source_language": "en",
        "target_language": "si",
        "translation_style": "conversational",
        "preserve_technical_terms": True
    }
    create_res = client.post("/api/v1/projects", json=create_payload)
    assert create_res.status_code == 201
    project_data = create_res.json()
    project_id = project_data["id"]

    # 3. Upload media file
    with open(test_wav, "rb") as f:
        upload_res = client.post(
            f"/api/v1/projects/{project_id}/upload",
            files={"file": ("test_audio.wav", f, "audio/wav")}
        )
    assert upload_res.status_code == 200
    updated_proj = upload_res.json()
    assert updated_proj["status"] == "uploaded"
    assert updated_proj["media_duration"] > 0

    # 4. Stream media check
    media_res = client.get(f"/api/v1/projects/{project_id}/media")
    assert media_res.status_code == 200
    assert len(media_res.content) > 0

    # 5. Add custom Sinhala subtitle cue
    cue_payload = {
        "sequence_number": 1,
        "start_time": 500,
        "end_time": 3200,
        "source_text": "Welcome to our video test.",
        "sinhala_text": "අපගේ වීඩියෝ පරීක්ෂණයට සාදරයෙන් පිළිගනිමු."
    }
    cue_res = client.post(f"/api/v1/projects/{project_id}/subtitles", json=cue_payload)
    assert cue_res.status_code == 201
    cue_data = cue_res.json()
    cue_id = cue_data["id"]
    assert cue_data["sinhala_text"] == "අපගේ වීඩියෝ පරීක්ෂණයට සාදරයෙන් පිළිගනිමු."

    # 6. Validate timeline
    val_res = client.post(f"/api/v1/projects/{project_id}/validate")
    assert val_res.status_code == 200
    assert val_res.json()["is_valid"] is True

    # 7. Edit cue text and timing
    patch_res = client.patch(
        f"/api/v1/projects/{project_id}/subtitles/{cue_id}",
        json={
            "start_time": 600,
            "end_time": 3500,
            "sinhala_text": "අපගේ වීඩියෝ පරීක්ෂණයට ඔබව සාදරයෙන් පිළිගනිමු!"
        }
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["sinhala_text"] == "අපගේ වීඩියෝ පරීක්ෂණයට ඔබව සාදරයෙන් පිළිගනිමු!"

    # 8. Export to SRT
    export_res = client.post(f"/api/v1/projects/{project_id}/export", json={"format": "srt"})
    assert export_res.status_code == 202
    exp_job = export_res.json()
    assert exp_job["status"] == "completed"
    assert exp_job["download_url"] is not None

    # 9. Download SRT and verify Sinhala Unicode contents and timestamps
    download_res = client.get(exp_job["download_url"])
    assert download_res.status_code == 200
    srt_content = download_res.text
    assert "00:00:00,600 --> 00:00:03,500" in srt_content
    assert "අපගේ වීඩියෝ පරීක්ෂණයට ඔබව සාදරයෙන් පිළිගනිමු!" in srt_content

    # 10. Export to VTT and verify
    vtt_export_res = client.post(f"/api/v1/projects/{project_id}/export", json={"format": "vtt"})
    assert vtt_export_res.status_code == 202
    vtt_download_res = client.get(vtt_export_res.json()["download_url"])
    assert vtt_download_res.status_code == 200
    assert "WEBVTT" in vtt_download_res.text
    assert "00:00:00.600 --> 00:00:03.500" in vtt_download_res.text

    # 11. Delete project cleanup
    del_res = client.delete(f"/api/v1/projects/{project_id}")
    assert del_res.status_code == 204

    # Confirm deletion
    get_res = client.get(f"/api/v1/projects/{project_id}")
    assert get_res.status_code == 404
