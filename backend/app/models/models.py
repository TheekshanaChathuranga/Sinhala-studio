import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

def generate_uuid() -> str:
    return str(uuid.uuid4())

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)

class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    owner_id = Column(String(100), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    original_filename = Column(String(255), nullable=False, default="")
    stored_filename = Column(String(255), nullable=False, default="")
    media_type = Column(String(100), nullable=False, default="video/mp4")
    media_duration = Column(Float, default=0.0)
    file_size = Column(Integer, default=0)
    
    # Timeline project configuration
    aspect_ratio = Column(String(20), default="16:9")
    timeline_data = Column(JSON, nullable=True)

    source_language = Column(String(20), default="auto")
    detected_language = Column(String(20), nullable=True)
    target_language = Column(String(20), default="si")
    translation_style = Column(String(50), default="conversational")
    preserve_technical_terms = Column(Boolean, default=True)
    
    status = Column(String(50), default="created")  # created, uploaded, processing, ready, failed
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)
    file_retention_status = Column(String(50), default="active")

    # Relationships
    cues = relationship("SubtitleCue", back_populates="project", cascade="all, delete-orphan", order_by="SubtitleCue.sequence_number")
    jobs = relationship("ProcessingJob", back_populates="project", cascade="all, delete-orphan", order_by="desc(ProcessingJob.created_at)")
    exports = relationship("ExportJob", back_populates="project", cascade="all, delete-orphan", order_by="desc(ExportJob.created_at)")
    assets = relationship("MediaAsset", back_populates="project", cascade="all, delete-orphan", order_by="desc(MediaAsset.created_at)")


class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    stored_filename = Column(String(255), nullable=False)
    asset_type = Column(String(50), nullable=False)  # video, audio, image
    duration = Column(Float, default=0.0)
    width = Column(Integer, default=0)
    height = Column(Integer, default=0)
    fps = Column(Float, default=30.0)
    file_size = Column(Integer, default=0)
    thumbnail_filename = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=get_utc_now)

    project = relationship("Project", back_populates="assets")


class SubtitleCue(Base):
    __tablename__ = "subtitle_cues"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence_number = Column(Integer, nullable=False, index=True)
    
    # Milliseconds
    start_time = Column(Integer, nullable=False, index=True)
    end_time = Column(Integer, nullable=False)
    
    source_text = Column(Text, nullable=False)
    sinhala_text = Column(Text, nullable=False)
    
    speaker = Column(String(100), nullable=True)
    confidence = Column(Float, nullable=True)
    is_edited = Column(Boolean, default=False)
    
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    # Relationship
    project = relationship("Project", back_populates="cues")


class ProcessingJob(Base):
    __tablename__ = "processing_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    job_type = Column(String(50), default="full_pipeline")
    current_stage = Column(String(50), default="queued")
    status = Column(String(50), default="queued")  # queued, processing, completed, failed, cancelled
    progress = Column(Float, default=0.0)
    
    error_code = Column(String(100), nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0)
    
    stage_message = Column(String(255), nullable=True)
    timing_metrics = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=get_utc_now)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # Relationship
    project = relationship("Project", back_populates="jobs")


class ExportJob(Base):
    __tablename__ = "export_jobs"

    id = Column(String(36), primary_key=True, default=generate_uuid, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    
    export_format = Column(String(20), nullable=False)  # srt, vtt, txt, mp4_rendered, mp4_hardcoded, mp4_soft
    status = Column(String(50), default="queued")  # queued, processing, completed, failed
    progress = Column(Float, default=0.0)
    
    styling_config = Column(JSON, nullable=True)
    output_path = Column(String(500), nullable=True)
    output_filename = Column(String(255), nullable=True)
    file_size = Column(Integer, default=0)
    
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=get_utc_now)
    completed_at = Column(DateTime, nullable=True)
    expiration_time = Column(DateTime, nullable=True)

    # Relationship
    project = relationship("Project", back_populates="exports")
