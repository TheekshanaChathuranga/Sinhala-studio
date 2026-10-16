import os
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Project, SubtitleCue, ProcessingJob
from app.utils.ffmpeg_utils import extract_audio_to_wav, extract_media_metadata
from app.services.asr_service import get_asr_service
from app.services.segmentation_service import segment_transcription
from app.services.translation_service import get_translation_provider

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
    max_lines: int = 2
) -> ProcessingJob:
    """
    Executes the complete AI subtitle pipeline for a project:
    Audio Extraction -> Speech Recognition -> Subtitle Segmentation -> Sinhala Translation -> DB Persistence.
    """
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

    try:
        # Stage 1: Media Inspection & Audio Extraction
        update_job_stage(db, job, "extracting_audio", 15.0, "Extracting audio track using FFmpeg...")
        if not os.path.exists(media_path):
            raise FileNotFoundError(f"Media file {project.stored_filename} was not found on server.")

        # Ensure metadata is updated
        metadata = extract_media_metadata(media_path)
        if metadata.get("duration", 0) > 0 and project.media_duration == 0:
            project.media_duration = metadata["duration"]

        extract_audio_to_wav(media_path, audio_wav_path)
        update_job_stage(db, job, "audio_extracted", 25.0, "Audio extracted to 16kHz WAV successfully.")

        # Stage 2: Speech Recognition (ASR)
        update_job_stage(db, job, "speech_recognition", 35.0, "Recognizing spoken speech with Whisper AI...")
        asr = get_asr_service(provider=settings.ASR_PROVIDER, model_name=settings.ASR_MODEL)
        
        asr_result = asr.transcribe(audio_wav_path, language=project.source_language)
        detected_lang = asr_result.get("detected_language", "en")
        raw_segments = asr_result.get("segments", [])

        project.detected_language = detected_lang
        db.commit()

        if not raw_segments:
            logger.warning(f"No speech detected in audio for project {project_id}.")
            raw_segments = [{
                "start": 0.0,
                "end": max(project.media_duration, 2.0),
                "text": "(No distinct speech detected)",
                "words": []
            }]

        update_job_stage(db, job, "speech_recognized", 60.0, f"Speech recognized. Detected language: {detected_lang}.")

        # Stage 3: Subtitle Segmentation & Timing
        update_job_stage(db, job, "segmenting_subtitles", 65.0, "Aligning timestamps and formatting subtitle cues...")
        timed_cues = segment_transcription(
            raw_segments=raw_segments,
            max_chars_per_line=max_chars_per_line,
            max_lines=max_lines
        )

        update_job_stage(db, job, "segmented", 72.0, f"Generated {len(timed_cues)} subtitle cues.")

        # Stage 4: Sinhala Translation
        update_job_stage(db, job, "translating", 78.0, "Translating text into natural Sinhala Unicode...")
        
        # If source is already Sinhala, skip translation and use source_text
        if detected_lang == "si" or project.source_language == "si":
            for cue in timed_cues:
                cue["sinhala_text"] = cue.get("source_text", "")
        else:
            translator = get_translation_provider(settings.TRANSLATION_PROVIDER)
            timed_cues = translator.translate_segments(
                segments=timed_cues,
                source_language=detected_lang,
                target_language="si",
                style=project.translation_style,
                preserve_technical_terms=project.preserve_technical_terms
            )

        update_job_stage(db, job, "translated", 92.0, "Sinhala translation completed.")

        # Stage 5: Database Persistence
        update_job_stage(db, job, "saving_cues", 95.0, "Saving subtitle project to database...")
        # Clear any existing cues for this project
        db.query(SubtitleCue).filter(SubtitleCue.project_id == project.id).delete()

        for cue_data in timed_cues:
            cue_model = SubtitleCue(
                project_id=project.id,
                sequence_number=cue_data["sequence_number"],
                start_time=cue_data["start_time"],
                end_time=cue_data["end_time"],
                source_text=cue_data.get("source_text", ""),
                sinhala_text=cue_data.get("sinhala_text", cue_data.get("source_text", ""))
            )
            db.add(cue_model)

        project.status = "ready"
        job.status = "completed"
        job.current_stage = "completed"
        job.progress = 100.0
        job.stage_message = f"Subtitles generated successfully ({len(timed_cues)} cues)."
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Pipeline finished successfully for project {project_id}.")
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
