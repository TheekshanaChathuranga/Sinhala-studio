import os
import shutil
import uuid
import logging
from typing import List, Optional, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.models.models import Project, ProcessingJob, SubtitleCue, MediaAsset, ExportJob
from app.schemas.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem,
    GenerateSubtitlesRequest, ProcessingJobResponse, MediaAssetResponse,
    TimelineUpdateRequest, ExportJobResponse, ExportRequest
)
from app.utils.ffmpeg_utils import extract_media_metadata, generate_thumbnail
from app.services.pipeline_orchestrator import run_pipeline_for_project
from app.services.video_render_service import render_timeline_project

router = APIRouter(prefix="/projects", tags=["projects"])

def run_pipeline_task(project_id: str, job_id: str, max_chars: int, max_lines: int, beam_size: int = 5, word_timestamps: bool = True):
    """Background task runner for ASR & Sinhala translation."""
    db = SessionLocal()
    try:
        run_pipeline_for_project(
            db=db,
            project_id=project_id,
            job_id=job_id,
            max_chars_per_line=max_chars,
            max_lines=max_lines,
            beam_size=beam_size,
            word_timestamps=word_timestamps
        )
    finally:
        db.close()


def run_render_task(export_id: str):
    """Background task runner for FFmpeg video rendering."""
    db = SessionLocal()
    try:
        render_timeline_project(db, export_id)
    finally:
        db.close()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(project_in: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new video editing project."""
    initial_timeline = {
        "aspect_ratio": project_in.aspect_ratio or "16:9",
        "duration_ms": 0,
        "tracks": [
            {"id": "track_text", "type": "text", "name": "Text & Titles", "order": 0, "muted": False, "visible": True, "locked": False, "clips": []},
            {"id": "track_subtitles", "type": "subtitle", "name": "Sinhala Subtitles", "order": 1, "muted": False, "visible": True, "locked": False, "clips": []},
            {"id": "track_video_main", "type": "video", "name": "Main Video", "order": 2, "muted": False, "visible": True, "locked": False, "clips": []},
            {"id": "track_video_overlay", "type": "overlay", "name": "Overlay / B-Roll", "order": 3, "muted": False, "visible": True, "locked": False, "clips": []},
            {"id": "track_audio", "type": "audio", "name": "Background Audio", "order": 4, "muted": False, "visible": True, "locked": False, "clips": []},
        ]
    }

    project = Project(
        title=project_in.title or "Sinhala Studio Project",
        aspect_ratio=project_in.aspect_ratio or "16:9",
        timeline_data=initial_timeline,
        original_filename="",
        stored_filename="",
        media_type="",
        source_language=project_in.source_language,
        target_language=project_in.target_language,
        translation_style=project_in.translation_style,
        preserve_technical_terms=project_in.preserve_technical_terms,
        status="created"
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectListItem])
def list_projects(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """List recent projects with cue counts and aspect ratio."""
    projects = db.query(Project).order_by(desc(Project.created_at)).offset(skip).limit(limit).all()
    results = []
    for p in projects:
        results.append(ProjectListItem(
            id=p.id,
            title=p.title,
            original_filename=p.original_filename,
            media_type=p.media_type,
            media_duration=p.media_duration,
            file_size=p.file_size,
            aspect_ratio=p.aspect_ratio or "16:9",
            source_language=p.source_language,
            detected_language=p.detected_language,
            target_language=p.target_language,
            status=p.status,
            cue_count=len(p.cues),
            created_at=p.created_at,
            updated_at=p.updated_at
        ))
    return results


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(project_id: str, db: Session = Depends(get_db)):
    """Retrieve full project data including cues, assets, timeline data, and latest job status."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Add URLs for assets
    for asset in project.assets:
        setattr(asset, "thumbnail_url", f"/api/v1/projects/{project_id}/assets/{asset.id}/thumbnail" if asset.thumbnail_filename else None)
        setattr(asset, "media_url", f"/api/v1/projects/{project_id}/assets/{asset.id}/media")

    latest_job = db.query(ProcessingJob).filter(ProcessingJob.project_id == project_id).order_by(desc(ProcessingJob.created_at)).first()
    setattr(project, "latest_job", latest_job)
    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, project_update: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    update_data = project_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return project


@router.put("/{project_id}/timeline", response_model=ProjectResponse)
def update_timeline(project_id: str, req: TimelineUpdateRequest, db: Session = Depends(get_db)):
    """Save or autosave multi-track timeline project state."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.timeline_data = req.timeline_data
    if req.aspect_ratio:
        project.aspect_ratio = req.aspect_ratio

    db.commit()
    db.refresh(project)
    return project


@router.post("/{project_id}/upload", response_model=ProjectResponse)
async def upload_project_media(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Primary media upload: saves media, generates thumbnail, registers as MediaAsset,
    and updates project main track clip.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    filename = file.filename or "media_upload"
    ext = Path(filename).suffix.lower()
    allowed_exts = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".png", ".jpg", ".jpeg"}
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{ext}'."
        )

    safe_filename = f"{project.id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = settings.STORAGE_DIR / "uploads" / safe_filename

    file_size = 0
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    with open(dest_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            if file_size > max_bytes:
                buffer.close()
                if os.path.exists(dest_path):
                    os.remove(dest_path)
                raise HTTPException(status_code=413, detail="File exceeds upload limit.")
            buffer.write(chunk)

    # Extract metadata
    metadata = extract_media_metadata(str(dest_path))
    duration = metadata.get("duration", 0.0)
    width = metadata.get("width", 1920)
    height = metadata.get("height", 1080)
    fps = metadata.get("fps", 30.0)
    is_video = metadata.get("has_video", True)

    # Generate thumbnail
    thumb_filename = f"thumb_{uuid.uuid4().hex[:8]}.jpg"
    thumb_path = str(settings.STORAGE_DIR / "uploads" / thumb_filename)
    if is_video:
        generate_thumbnail(str(dest_path), thumb_path, time_sec=min(1.0, max(0.1, duration / 2.0)))
    else:
        thumb_filename = None

    # Register as MediaAsset
    asset = MediaAsset(
        project_id=project.id,
        name=filename,
        stored_filename=safe_filename,
        asset_type="video" if is_video else ("image" if ext in {".png", ".jpg", ".jpeg"} else "audio"),
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        file_size=file_size,
        thumbnail_filename=thumb_filename
    )
    db.add(asset)

    # Update project primary media
    media_type = file.content_type or ("video/" + ext[1:] if is_video else "audio/" + ext[1:])
    project.original_filename = filename
    project.stored_filename = safe_filename
    project.media_type = media_type
    project.media_duration = duration
    project.file_size = file_size
    project.title = project.title if project.title and project.title != "Sinhala Studio Project" else Path(filename).stem
    project.status = "uploaded"

    # Add clip to timeline main video track
    duration_ms = int(duration * 1000)
    timeline = project.timeline_data or {}
    tracks = timeline.get("tracks", [])
    video_track = next((t for t in tracks if t.get("type") == "video"), None)
    if video_track:
        clip_id = f"clip_{uuid.uuid4().hex[:8]}"
        new_clip = {
            "id": clip_id,
            "asset_id": asset.id,
            "type": "video" if is_video else "audio",
            "name": filename,
            "timeline_start_ms": 0,
            "duration_ms": duration_ms or 5000,
            "source_start_ms": 0,
            "source_end_ms": duration_ms or 5000,
            "playback_rate": 1.0,
            "volume": 1.0,
            "transform": {"scale": 1.0, "x": 0.0, "y": 0.0, "rotation": 0.0, "opacity": 1.0}
        }
        video_track["clips"] = [new_clip]
        timeline["duration_ms"] = max(timeline.get("duration_ms", 0), duration_ms)
        project.timeline_data = timeline

    db.commit()
    db.refresh(project)
    return project


# --- Media Asset Endpoints ---
@router.post("/{project_id}/assets", response_model=MediaAssetResponse)
async def add_project_asset(
    project_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """Import media asset into project library."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    filename = file.filename or "asset_upload"
    ext = Path(filename).suffix.lower()
    safe_filename = f"asset_{project.id}_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = settings.STORAGE_DIR / "uploads" / safe_filename

    file_size = 0
    with open(dest_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            buffer.write(chunk)

    metadata = extract_media_metadata(str(dest_path))
    duration = metadata.get("duration", 0.0)
    width = metadata.get("width", 1920)
    height = metadata.get("height", 1080)
    fps = metadata.get("fps", 30.0)
    is_video = metadata.get("has_video", False)
    is_image = ext in {".png", ".jpg", ".jpeg", ".webp"}

    thumb_filename = None
    if is_video:
        thumb_filename = f"thumb_{uuid.uuid4().hex[:8]}.jpg"
        generate_thumbnail(str(dest_path), str(settings.STORAGE_DIR / "uploads" / thumb_filename), time_sec=min(1.0, max(0.1, duration / 2.0)))

    asset_type = "video" if is_video else ("image" if is_image else "audio")

    asset = MediaAsset(
        project_id=project.id,
        name=filename,
        stored_filename=safe_filename,
        asset_type=asset_type,
        duration=duration,
        width=width,
        height=height,
        fps=fps,
        file_size=file_size,
        thumbnail_filename=thumb_filename
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    setattr(asset, "thumbnail_url", f"/api/v1/projects/{project_id}/assets/{asset.id}/thumbnail" if asset.thumbnail_filename else None)
    setattr(asset, "media_url", f"/api/v1/projects/{project_id}/assets/{asset.id}/media")
    return asset


@router.get("/{project_id}/assets", response_model=List[MediaAssetResponse])
def list_project_assets(project_id: str, db: Session = Depends(get_db)):
    assets = db.query(MediaAsset).filter(MediaAsset.project_id == project_id).order_by(desc(MediaAsset.created_at)).all()
    for a in assets:
        setattr(a, "thumbnail_url", f"/api/v1/projects/{project_id}/assets/{a.id}/thumbnail" if a.thumbnail_filename else None)
        setattr(a, "media_url", f"/api/v1/projects/{project_id}/assets/{a.id}/media")
    return assets


@router.get("/{project_id}/assets/{asset_id}/media")
def stream_asset(project_id: str, asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id, MediaAsset.project_id == project_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    file_path = settings.STORAGE_DIR / "uploads" / asset.stored_filename
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Asset file missing")

    ext = Path(asset.stored_filename).suffix.lower()
    media_type = f"{asset.asset_type}/{ext[1:]}" if asset.asset_type in ("video", "audio") else "image/jpeg"
    return FileResponse(path=str(file_path), media_type=media_type, filename=asset.name)


@router.get("/{project_id}/assets/{asset_id}/thumbnail")
def get_asset_thumbnail(project_id: str, asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id, MediaAsset.project_id == project_id).first()
    if not asset or not asset.thumbnail_filename:
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    thumb_path = settings.STORAGE_DIR / "uploads" / asset.thumbnail_filename
    if not os.path.exists(thumb_path):
        raise HTTPException(status_code=404, detail="Thumbnail file missing")

    return FileResponse(path=str(thumb_path), media_type="image/jpeg")


@router.delete("/{project_id}/assets/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_asset(project_id: str, asset_id: str, db: Session = Depends(get_db)):
    asset = db.query(MediaAsset).filter(MediaAsset.id == asset_id, MediaAsset.project_id == project_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    file_path = settings.STORAGE_DIR / "uploads" / asset.stored_filename
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    if asset.thumbnail_filename:
        thumb_path = settings.STORAGE_DIR / "uploads" / asset.thumbnail_filename
        if os.path.exists(thumb_path):
            try:
                os.remove(thumb_path)
            except Exception:
                pass

    db.delete(asset)
    db.commit()
    return None


@router.get("/{project_id}/media")
def get_project_media(project_id: str, db: Session = Depends(get_db)):
    """Serve primary media file for preview in frontend HTML5 player."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project or not project.stored_filename:
        raise HTTPException(status_code=404, detail="Media not found")

    file_path = settings.STORAGE_DIR / "uploads" / project.stored_filename
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Stored media file missing from disk")

    return FileResponse(
        path=str(file_path),
        media_type=project.media_type or "application/octet-stream",
        filename=project.original_filename
    )


@router.post("/{project_id}/generate", response_model=ProcessingJobResponse)
def generate_subtitles(
    project_id: str,
    gen_request: GenerateSubtitlesRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start asynchronous subtitle generation pipeline."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if not project.stored_filename:
        raise HTTPException(status_code=400, detail="Cannot generate subtitles before uploading media.")

    # Prevent duplicate concurrent jobs
    active_job = db.query(ProcessingJob).filter(
        ProcessingJob.project_id == project.id,
        ProcessingJob.status.in_(["queued", "processing"])
    ).order_by(desc(ProcessingJob.created_at)).first()

    if active_job:
        logger.info(f"Returning already active job {active_job.id} for project {project.id}")
        return active_job

    if gen_request.source_language:
        project.source_language = gen_request.source_language
    if gen_request.target_language:
        project.target_language = gen_request.target_language
    if gen_request.translation_style:
        project.translation_style = gen_request.translation_style
    if gen_request.preserve_technical_terms is not None:
        project.preserve_technical_terms = gen_request.preserve_technical_terms

    job = ProcessingJob(
        project_id=project.id,
        job_type="full_pipeline",
        current_stage="queued",
        status="queued",
        progress=0.0,
        stage_message="Job queued for processing."
    )
    db.add(job)
    project.status = "queued"
    db.commit()
    db.refresh(job)

    background_tasks.add_task(
        run_pipeline_task,
        project_id=project.id,
        job_id=job.id,
        max_chars=gen_request.max_chars_per_line or 42,
        max_lines=gen_request.max_lines or 2,
        beam_size=gen_request.beam_size if gen_request.beam_size is not None else 5,
        word_timestamps=gen_request.word_timestamps if gen_request.word_timestamps is not None else True
    )

    return job


@router.post("/{project_id}/render", response_model=ExportJobResponse, status_code=status.HTTP_202_ACCEPTED)
def render_video_export(
    project_id: str,
    export_req: ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Start asynchronous FFmpeg multi-track video render job."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    styling_cfg = export_req.styling.model_dump() if export_req.styling else {}
    styling_cfg["resolution"] = export_req.resolution or "1080p"

    export_job = ExportJob(
        project_id=project.id,
        export_format="mp4_rendered",
        status="queued",
        progress=0.0,
        styling_config=styling_cfg
    )
    db.add(export_job)
    db.commit()
    db.refresh(export_job)

    background_tasks.add_task(run_render_task, export_job.id)

    resp = ExportJobResponse.model_validate(export_job)
    resp.download_url = f"/api/v1/exports/{export_job.id}/download"
    return resp


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, db: Session = Depends(get_db)):
    """Delete project and remove associated files from storage."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.stored_filename:
        upload_path = settings.STORAGE_DIR / "uploads" / project.stored_filename
        if os.path.exists(upload_path):
            try:
                os.remove(upload_path)
            except Exception:
                pass

    audio_path = settings.STORAGE_DIR / "audio" / f"{project.id}.wav"
    if os.path.exists(audio_path):
        try:
            os.remove(audio_path)
        except Exception:
            pass

    for asset in project.assets:
        asset_file = settings.STORAGE_DIR / "uploads" / asset.stored_filename
        if os.path.exists(asset_file):
            try:
                os.remove(asset_file)
            except Exception:
                pass

    db.delete(project)
    db.commit()
    return None
