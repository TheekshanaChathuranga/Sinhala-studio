from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.models import Project, SubtitleCue
from app.schemas.schemas import (
    SubtitleCueCreate, SubtitleCueUpdate, SubtitleCueResponse,
    TimelineValidationResponse
)
from app.services.subtitle_service import validate_timeline

router = APIRouter(prefix="/projects/{project_id}", tags=["subtitles"])

@router.post("/subtitles", response_model=SubtitleCueResponse, status_code=status.HTTP_201_CREATED)
def add_subtitle_cue(project_id: str, cue_in: SubtitleCueCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cue = SubtitleCue(
        project_id=project_id,
        sequence_number=cue_in.sequence_number,
        start_time=cue_in.start_time,
        end_time=cue_in.end_time,
        source_text=cue_in.source_text,
        sinhala_text=cue_in.sinhala_text,
        speaker=cue_in.speaker,
        confidence=cue_in.confidence,
        is_edited=True
    )
    db.add(cue)
    db.commit()
    db.refresh(cue)
    return cue


@router.patch("/subtitles/{subtitle_id}", response_model=SubtitleCueResponse)
def update_subtitle_cue(
    project_id: str,
    subtitle_id: str,
    cue_update: SubtitleCueUpdate,
    db: Session = Depends(get_db)
):
    cue = db.query(SubtitleCue).filter(
        SubtitleCue.id == subtitle_id,
        SubtitleCue.project_id == project_id
    ).first()
    if not cue:
        raise HTTPException(status_code=404, detail="Subtitle cue not found")

    update_data = cue_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cue, key, value)
    
    cue.is_edited = True
    db.commit()
    db.refresh(cue)
    return cue


@router.delete("/subtitles/{subtitle_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_subtitle_cue(project_id: str, subtitle_id: str, db: Session = Depends(get_db)):
    cue = db.query(SubtitleCue).filter(
        SubtitleCue.id == subtitle_id,
        SubtitleCue.project_id == project_id
    ).first()
    if not cue:
        raise HTTPException(status_code=404, detail="Subtitle cue not found")

    db.delete(cue)
    db.commit()
    return None


@router.post("/validate", response_model=TimelineValidationResponse)
def validate_project_timeline(project_id: str, db: Session = Depends(get_db)):
    cues = db.query(SubtitleCue).filter(SubtitleCue.project_id == project_id).order_by(SubtitleCue.sequence_number).all()
    return validate_timeline(cues)
