import os
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.models.models import Project, ExportJob
from app.schemas.schemas import ExportRequest, ExportJobResponse
from app.services.export_service import process_export_job

router = APIRouter(tags=["exports"])

def run_export_task(export_id: str):
    db = SessionLocal()
    try:
        process_export_job(db, export_id)
    finally:
        db.close()


@router.post("/projects/{project_id}/export", response_model=ExportJobResponse, status_code=status.HTTP_202_ACCEPTED)
def request_export(
    project_id: str,
    export_req: ExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    fmt = export_req.format.lower()
    allowed_formats = {"srt", "vtt", "txt", "mp4_hardcoded", "mp4_soft"}
    if fmt not in allowed_formats:
        raise HTTPException(status_code=400, detail=f"Unsupported export format '{fmt}'.")

    export_job = ExportJob(
        project_id=project.id,
        export_format=fmt,
        status="queued",
        progress=0.0,
        styling_config=export_req.styling.model_dump() if export_req.styling else {}
    )
    db.add(export_job)
    db.commit()
    db.refresh(export_job)

    # For text formats (SRT, VTT, TXT), process synchronously for immediate response
    if fmt in ("srt", "vtt", "txt"):
        process_export_job(db, export_job.id)
        db.refresh(export_job)
    else:
        # Video encoding in background
        background_tasks.add_task(run_export_task, export_job.id)

    resp = ExportJobResponse.model_validate(export_job)
    resp.download_url = f"/api/v1/exports/{export_job.id}/download"
    return resp


@router.get("/exports/{export_id}", response_model=ExportJobResponse)
def get_export_status(export_id: str, db: Session = Depends(get_db)):
    export_job = db.query(ExportJob).filter(ExportJob.id == export_id).first()
    if not export_job:
        raise HTTPException(status_code=404, detail="Export job not found")

    resp = ExportJobResponse.model_validate(export_job)
    if export_job.status == "completed":
        resp.download_url = f"/api/v1/exports/{export_job.id}/download"
    return resp


@router.get("/exports/{export_id}/download")
def download_export(export_id: str, db: Session = Depends(get_db)):
    export_job = db.query(ExportJob).filter(ExportJob.id == export_id).first()
    if not export_job:
        raise HTTPException(status_code=404, detail="Export job not found")

    if export_job.status != "completed" or not export_job.output_path:
        raise HTTPException(status_code=400, detail="Export is not ready for download")

    if not os.path.exists(export_job.output_path):
        raise HTTPException(status_code=404, detail="Exported file missing from disk")

    media_type_map = {
        "srt": "application/x-subrip",
        "vtt": "text/vtt",
        "txt": "text/plain; charset=utf-8",
        "mp4_hardcoded": "video/mp4",
        "mp4_soft": "video/mp4"
    }

    media_type = media_type_map.get(export_job.export_format, "application/octet-stream")

    return FileResponse(
        path=export_job.output_path,
        media_type=media_type,
        filename=export_job.output_filename or f"subtitles.{export_job.export_format}"
    )
