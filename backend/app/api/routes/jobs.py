from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import ProcessingJob
from app.schemas.schemas import ProcessingJobResponse

router = APIRouter(prefix="/jobs", tags=["jobs"])

@router.get("/{job_id}", response_model=ProcessingJobResponse)
def get_job_status(job_id: str, db: Session = Depends(get_db)):
    job = db.query(ProcessingJob).filter(ProcessingJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Processing job not found")
    return job
