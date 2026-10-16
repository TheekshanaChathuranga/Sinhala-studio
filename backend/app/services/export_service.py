import os
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Project, SubtitleCue, ExportJob
from app.services.subtitle_service import format_cues_to_srt, format_cues_to_vtt, format_cues_to_txt
from app.services.video_render_service import render_timeline_project

logger = logging.getLogger(__name__)

def process_export_job(db: Session, export_id: str) -> ExportJob:
    export_job = db.query(ExportJob).filter(ExportJob.id == export_id).first()
    if not export_job:
        raise ValueError(f"Export job {export_id} not found.")

    project = db.query(Project).filter(Project.id == export_job.project_id).first()
    if not project:
        export_job.status = "failed"
        export_job.error_message = "Project not found"
        db.commit()
        return export_job

    fmt = export_job.export_format.lower()

    # Route video rendering to render_timeline_project
    if fmt in ("mp4_rendered", "mp4_hardcoded", "mp4"):
        return render_timeline_project(db, export_id)

    # Text subtitle exports
    cues = db.query(SubtitleCue).filter(SubtitleCue.project_id == project.id).order_by(SubtitleCue.sequence_number).all()
    if not cues:
        export_job.status = "failed"
        export_job.error_message = "No subtitle cues found to export."
        db.commit()
        return export_job

    base_name = Path(project.original_filename or project.title or "subtitles").stem
    exports_dir = settings.STORAGE_DIR / "exports"
    os.makedirs(exports_dir, exist_ok=True)

    export_job.status = "processing"
    export_job.progress = 10.0
    db.commit()

    try:
        if fmt == "srt":
            out_filename = f"{base_name}_sinhala.srt"
            out_path = str(exports_dir / f"{export_job.id}_{out_filename}")
            content = format_cues_to_srt(cues, use_sinhala=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)

        elif fmt == "vtt":
            out_filename = f"{base_name}_sinhala.vtt"
            out_path = str(exports_dir / f"{export_job.id}_{out_filename}")
            content = format_cues_to_vtt(cues, use_sinhala=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)

        elif fmt == "txt":
            out_filename = f"{base_name}_sinhala.txt"
            out_path = str(exports_dir / f"{export_job.id}_{out_filename}")
            content = format_cues_to_txt(cues, include_timestamps=True, use_sinhala=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(content)
        else:
            raise ValueError(f"Unsupported export format: {fmt}")

        file_size = os.path.getsize(out_path) if os.path.exists(out_path) else 0

        export_job.status = "completed"
        export_job.progress = 100.0
        export_job.output_path = out_path
        export_job.output_filename = out_filename
        export_job.file_size = file_size
        export_job.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Export {export_id} completed successfully: {out_filename} ({file_size} bytes)")
        return export_job

    except Exception as e:
        logger.error(f"Export {export_id} failed: {e}", exc_info=True)
        export_job.status = "failed"
        export_job.progress = 0.0
        export_job.error_message = str(e)
        db.commit()
        return export_job
