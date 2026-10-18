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
from app.services.singlish_transliterator import has_sinhala_unicode, transliterate_singlish_to_sinhala
from app.services.translation_service import get_translation_provider

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


@router.post("/subtitles/convert-sinhala", response_model=List[SubtitleCueResponse])
def convert_project_subtitles_to_sinhala(project_id: str, db: Session = Depends(get_db)):
    """
    Converts all subtitle cues in the project from Romanized / Singlish / English text
    into authentic Sinhala Unicode script.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    cues = db.query(SubtitleCue).filter(SubtitleCue.project_id == project_id).order_by(SubtitleCue.sequence_number).all()
    if not cues:
        return []

    cues_to_convert = []
    for c in cues:
        if c.sinhala_text and has_sinhala_unicode(c.sinhala_text):
            continue
        cues_to_convert.append(c)

    if cues_to_convert:
        translator = get_translation_provider("hybrid")
        raw_segments = [{"sequence_number": c.sequence_number, "source_text": c.source_text or c.sinhala_text} for c in cues_to_convert]
        try:
            translated = translator.translate_segments(
                segments=raw_segments,
                source_language=project.detected_language or "auto",
                target_language="si",
                style=project.translation_style or "conversational"
            )
            trans_map = {t["sequence_number"]: t.get("sinhala_text", "") for t in translated}
        except Exception:
            trans_map = {}

        for c in cues_to_convert:
            new_text = trans_map.get(c.sequence_number, "")
            if not new_text or not has_sinhala_unicode(new_text):
                new_text = transliterate_singlish_to_sinhala(c.source_text or c.sinhala_text)
            c.sinhala_text = new_text
            c.is_edited = True

        db.commit()

    for c in cues:
        db.refresh(c)

    return cues
