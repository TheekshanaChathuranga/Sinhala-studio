import os
import time
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Project, SubtitleCue, ProcessingJob
from app.utils.ffmpeg_utils import extract_audio_to_wav, extract_media_metadata
from app.services.asr_service import get_asr_service
from app.services.segmentation_service import segment_transcription
from app.services.translation_service import get_translation_provider
from app.services.singlish_transliterator import has_sinhala_unicode, transliterate_singlish_to_sinhala
from app.services.transcription_cache import (
    compute_media_fingerprint,
    get_cached_transcription,
    set_cached_transcription,
    get_cached_cues,
    set_cached_cues,
    _build_transcription_key
)

logger = logging.getLogger(__name__)

def update_job_stage(
    db: Session,
    job: ProcessingJob,
    stage: str,
    progress: float,
    message: str
):
    job.current_stage = stage
    job.progress = progress
    job.stage_message = message
    db.commit()
    logger.info(f"Job {job.id} - [{stage}] {progress:.1f}%: {message}")


def run_pipeline_for_project(
    db: Session,
    project_id: str,
    job_id: str,
    max_chars_per_line: int = 42,
    max_lines: int = 2,
    beam_size: int = 5,
    word_timestamps: bool = True
) -> ProcessingJob:
    """
    Executes the optimized AI subtitle pipeline:
    1. Media Inspection & Audio Fingerprinting
    2. Cached Audio / FFmpeg Audio Extraction
    3. Model Retrieval / Cache Lookup / ASR Inference
    4. Subtitle Segmentation & Timestamp Alignment
    5. Sinhala Unicode Normalization / Direct Mapping
    6. Batch Database Persistence & Timing Telemetry
    """
    t_start_total = time.perf_counter()

    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    project = db.query(Project).filter(Project.id == project_id).first()

    if not job or not project:
        raise ValueError("Invalid job or project ID.")

    job.status = "processing"
    job.started_at = datetime.now(timezone.utc)
    project.status = "processing"
    db.commit()

    media_path = str(settings.STORAGE_DIR / "uploads" / project.stored_filename)
    audio_wav_path = str(settings.STORAGE_DIR / "audio" / f"{project.id}.wav")

    metrics = {
        "media_duration_sec": 0.0,
        "inspection_ms": 0.0,
        "audio_extraction_ms": 0.0,
        "audio_extraction_cached": False,
        "asr_ms": 0.0,
        "asr_cached": False,
        "segmentation_ms": 0.0,
        "translation_ms": 0.0,
        "persistence_ms": 0.0,
        "total_processing_ms": 0.0,
        "real_time_factor": 0.0,
        "speedup_factor": 0.0,
        "model_name": settings.ASR_MODEL,
        "device": settings.ASR_DEVICE,
        "compute_type": settings.ASR_COMPUTE_TYPE
    }

    try:
        # --- Stage 1: Media Inspection & Fingerprinting ---
        t0 = time.perf_counter()
        update_job_stage(db, job, "inspecting_media", 10.0, "Inspecting media metadata and calculating fingerprint...")
        if not os.path.exists(media_path):
            raise FileNotFoundError(f"Media file {project.stored_filename} was not found on server.")

        metadata = extract_media_metadata(media_path)
        media_dur = metadata.get("duration", 0.0)
        if media_dur > 0 and project.media_duration == 0:
            project.media_duration = media_dur
        metrics["media_duration_sec"] = project.media_duration
        metrics["inspection_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        fingerprint = compute_media_fingerprint(media_path)

        # --- Stage 2: Audio Extraction (with fresh cache verification) ---
        t0 = time.perf_counter()
        update_job_stage(db, job, "extracting_audio", 20.0, "Extracting audio track for transcription...")
        is_audio_cached = os.path.exists(audio_wav_path) and os.path.getsize(audio_wav_path) > 1024
        extract_audio_to_wav(media_path, audio_wav_path)
        metrics["audio_extraction_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        metrics["audio_extraction_cached"] = is_audio_cached

        update_job_stage(
            db, job, "audio_extracted", 35.0,
            "Audio ready (cached)" if is_audio_cached else "Audio extracted to 16kHz PCM WAV."
        )

        # --- Stage 3: Speech Recognition (ASR with Content Caching) ---
        t0 = time.perf_counter()
        asr_key = _build_transcription_key(fingerprint, settings.ASR_MODEL, project.source_language, beam_size)
        cached_asr = get_cached_transcription(fingerprint, settings.ASR_MODEL, project.source_language, beam_size)

        if cached_asr:
            asr_result = cached_asr
            detected_lang = asr_result.get("detected_language", "si")
            raw_segments = asr_result.get("segments", [])
            metrics["asr_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            metrics["asr_cached"] = True
            update_job_stage(db, job, "speech_recognized", 65.0, f"Speech transcript restored from cache ({detected_lang}).")
        else:
            update_job_stage(db, job, "speech_recognition", 45.0, f"Running faster-whisper ({settings.ASR_MODEL}) on {settings.ASR_DEVICE}...")
            asr = get_asr_service(
                provider=settings.ASR_PROVIDER,
                model_name=settings.ASR_MODEL,
                device=settings.ASR_DEVICE,
                compute_type=settings.ASR_COMPUTE_TYPE
            )

            asr_result = asr.transcribe(
                audio_wav_path,
                language=project.source_language,
                beam_size=beam_size,
                word_timestamps=word_timestamps
            )
            detected_lang = asr_result.get("detected_language", "si")
            raw_segments = asr_result.get("segments", [])

            # Persist to fast cache
            set_cached_transcription(fingerprint, settings.ASR_MODEL, project.source_language, beam_size, asr_result)

            metrics["asr_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            metrics["asr_cached"] = False
            update_job_stage(db, job, "speech_recognized", 65.0, f"Speech recognized. Detected language: {detected_lang}.")

        project.detected_language = detected_lang
        db.commit()

        if not raw_segments:
            logger.warning(f"No speech detected in audio for project {project_id}.")
            raw_segments = [{
                "start": 0.0,
                "end": max(project.media_duration, 2.0),
                "text": "පැහැදිලි කථනයක් හඳුනා නොගැනිණි",
                "words": []
            }]

        # --- Stage 4: Subtitle Segmentation & Formatting ---
        t0 = time.perf_counter()
        update_job_stage(db, job, "segmenting_subtitles", 75.0, "Formatting and segmenting subtitle cues...")

        cached_cues = get_cached_cues(asr_key, max_chars_per_line, max_lines)
        if cached_cues:
            timed_cues = cached_cues
        else:
            timed_cues = segment_transcription(
                raw_segments=raw_segments,
                max_chars_per_line=max_chars_per_line,
                max_lines=max_lines
            )
            set_cached_cues(asr_key, max_chars_per_line, max_lines, timed_cues)

        metrics["segmentation_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        update_job_stage(db, job, "segmented", 82.0, f"Generated {len(timed_cues)} formatted cues.")

        # --- Stage 5: Sinhala Text Alignment / Direct Mapping ---
        t0 = time.perf_counter()
        update_job_stage(db, job, "translating", 88.0, "Synchronizing Sinhala text...")
        
        # Check if transcribed cues already contain genuine Sinhala Unicode script
        has_sinhala = any(has_sinhala_unicode(cue.get("source_text", "")) for cue in timed_cues)

        if has_sinhala and (detected_lang == "si" or project.source_language == "si"):
            for cue in timed_cues:
                if not cue.get("sinhala_text"):
                    cue["sinhala_text"] = cue.get("source_text", "")
        else:
            # Source text is in Latin/English characters (either foreign audio or romanized Singlish/Pali phonetics)
            translator = get_translation_provider(settings.TRANSLATION_PROVIDER)
            timed_cues = translator.translate_segments(
                segments=timed_cues,
                source_language=detected_lang,
                target_language="si",
                style=project.translation_style,
                preserve_technical_terms=project.preserve_technical_terms
            )
            # Guarantee every cue has genuine Sinhala Unicode text
            for cue in timed_cues:
                st = cue.get("sinhala_text", "").strip()
                if not st or not has_sinhala_unicode(st):
                    cue["sinhala_text"] = transliterate_singlish_to_sinhala(cue.get("source_text", ""))

        metrics["translation_ms"] = round((time.perf_counter() - t0) * 1000, 2)
        update_job_stage(db, job, "translated", 93.0, "Sinhala text synchronization complete.")

        # --- Stage 6: Database Persistence ---
        t0 = time.perf_counter()
        update_job_stage(db, job, "saving_cues", 96.0, "Saving subtitle cues to project...")

        # Clear existing cues
        db.query(SubtitleCue).filter(SubtitleCue.project_id == project.id).delete()

        # Bulk insert
        cue_objects = [
            SubtitleCue(
                project_id=project.id,
                sequence_number=cue_data["sequence_number"],
                start_time=cue_data["start_time"],
                end_time=cue_data["end_time"],
                source_text=cue_data.get("source_text", ""),
                sinhala_text=cue_data.get("sinhala_text", cue_data.get("source_text", ""))
            )
            for cue_data in timed_cues
        ]
        db.bulk_save_objects(cue_objects)
        metrics["persistence_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # Calculate final telemetry & Real-Time Factor (RTF)
        t_total_sec = time.perf_counter() - t_start_total
        metrics["total_processing_ms"] = round(t_total_sec * 1000, 2)
        media_sec = max(project.media_duration, 0.001)
        rtf = round(t_total_sec / media_sec, 4)
        metrics["real_time_factor"] = rtf
        metrics["speedup_factor"] = round(media_sec / max(t_total_sec, 0.0001), 1)

        project.status = "ready"
        job.status = "completed"
        job.current_stage = "completed"
        job.progress = 100.0
        job.timing_metrics = metrics
        job.stage_message = f"Subtitles generated successfully ({len(timed_cues)} cues in {t_total_sec:.2f}s, {metrics['speedup_factor']}x RTF)."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(
            f"Pipeline finished for project {project_id}: "
            f"Total {t_total_sec:.2f}s | RTF {rtf:.4f} ({metrics['speedup_factor']}x real-time) | "
            f"Cues: {len(timed_cues)} | ASR cached: {metrics['asr_cached']}"
        )
        return job

    except Exception as e:
        logger.error(f"Pipeline error for project {project_id}: {e}", exc_info=True)
        job.status = "failed"
        job.error_code = type(e).__name__
        job.error_message = str(e)
        job.completed_at = datetime.now(timezone.utc)
        project.status = "failed"
        db.commit()
        return job
