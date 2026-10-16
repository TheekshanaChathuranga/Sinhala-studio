from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

# --- Subtitle Cue Schemas ---
class SubtitleCueBase(BaseModel):
    sequence_number: int
    start_time: int = Field(..., description="Start time in milliseconds", ge=0)
    end_time: int = Field(..., description="End time in milliseconds", ge=0)
    source_text: str = ""
    sinhala_text: str = ""
    speaker: Optional[str] = None
    confidence: Optional[float] = None

class SubtitleCueCreate(SubtitleCueBase):
    pass

class SubtitleCueUpdate(BaseModel):
    start_time: Optional[int] = Field(None, ge=0)
    end_time: Optional[int] = Field(None, ge=0)
    source_text: Optional[str] = None
    sinhala_text: Optional[str] = None
    speaker: Optional[str] = None
    sequence_number: Optional[int] = None

class SubtitleCueResponse(SubtitleCueBase):
    id: str
    project_id: str
    is_edited: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SubtitleBatchUpdateRequest(BaseModel):
    cues: List[SubtitleCueUpdate]

# --- Processing Job Schemas ---
class ProcessingJobResponse(BaseModel):
    id: str
    project_id: str
    job_type: str
    current_stage: str
    status: str
    progress: float
    stage_message: Optional[str] = None
    timing_metrics: Optional[Dict[str, Any]] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    created_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

# --- Media Asset Schemas ---
class MediaAssetResponse(BaseModel):
    id: str
    project_id: str
    name: str
    stored_filename: str
    asset_type: str
    duration: float
    width: int
    height: int
    fps: float
    file_size: int
    thumbnail_url: Optional[str] = None
    media_url: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Timeline & Clip Schemas ---
class ClipTransform(BaseModel):
    scale: float = 1.0
    x: float = 0.0
    y: float = 0.0
    rotation: float = 0.0
    opacity: float = 1.0

class TextOverlaySettings(BaseModel):
    content: str = "Title Overlay"
    font_name: str = "Noto Sans Sinhala"
    font_size: int = 36
    text_color: str = "#FFFFFF"
    background_color: str = "#000000"
    background_opacity: float = 0.0
    outline_color: str = "#000000"
    outline_width: int = 2
    shadow_color: str = "#000000"
    shadow_offset: int = 2
    animation: str = "none"  # none, fade, slide_up, pop
    position_x: float = 0.5   # 0.0 - 1.0
    position_y: float = 0.8   # 0.0 - 1.0

class TimelineClipSchema(BaseModel):
    id: str
    asset_id: Optional[str] = None
    type: str = "video"  # video, image, audio, text, subtitle
    timeline_start_ms: int = 0
    duration_ms: int = 3000
    source_start_ms: int = 0
    source_end_ms: int = 3000
    playback_rate: float = 1.0
    volume: float = 1.0
    transform: Optional[ClipTransform] = None
    text_settings: Optional[TextOverlaySettings] = None
    name: Optional[str] = None

class TimelineTrackSchema(BaseModel):
    id: str
    type: str  # video, overlay, text, subtitle, audio
    name: str
    order: int = 0
    muted: bool = False
    visible: bool = True
    locked: bool = False
    clips: List[TimelineClipSchema] = []

class TimelineUpdateRequest(BaseModel):
    aspect_ratio: Optional[str] = "16:9"
    timeline_data: Dict[str, Any]

# --- Project Schemas ---
class ProjectCreate(BaseModel):
    title: Optional[str] = None
    aspect_ratio: Optional[str] = "16:9"
    source_language: str = "auto"
    target_language: str = "si"
    translation_style: str = "conversational"
    preserve_technical_terms: bool = True

class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    aspect_ratio: Optional[str] = None
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    translation_style: Optional[str] = None
    preserve_technical_terms: Optional[bool] = None

class ProjectResponse(BaseModel):
    id: str
    title: Optional[str] = None
    original_filename: str
    stored_filename: str
    media_type: str
    media_duration: float
    file_size: int
    aspect_ratio: str
    timeline_data: Optional[Dict[str, Any]] = None
    source_language: str
    detected_language: Optional[str] = None
    target_language: str
    translation_style: str
    preserve_technical_terms: bool
    status: str
    created_at: datetime
    updated_at: datetime
    cues: List[SubtitleCueResponse] = []
    assets: List[MediaAssetResponse] = []
    latest_job: Optional[ProcessingJobResponse] = None

    model_config = ConfigDict(from_attributes=True)

class ProjectListItem(BaseModel):
    id: str
    title: Optional[str] = None
    original_filename: str
    media_type: str
    media_duration: float
    file_size: int
    aspect_ratio: str = "16:9"
    source_language: str
    detected_language: Optional[str] = None
    target_language: str
    status: str
    cue_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

# --- Generation Request ---
class GenerateSubtitlesRequest(BaseModel):
    source_language: Optional[str] = "auto"
    target_language: Optional[str] = "si"
    translation_style: Optional[str] = "conversational"
    preserve_technical_terms: Optional[bool] = True
    asr_model: Optional[str] = "tiny"
    max_chars_per_line: Optional[int] = 42
    max_lines: Optional[int] = 2
    beam_size: Optional[int] = 5
    word_timestamps: Optional[bool] = True

# --- Export Schemas ---
class SubtitleStylingConfig(BaseModel):
    preset_name: Optional[str] = "default"
    font_size: int = 28
    font_name: str = "Noto Sans Sinhala"
    text_color: str = "#FFFFFF"
    background_color: str = "#000000"
    background_opacity: float = 0.6
    outline_color: str = "#000000"
    outline_width: int = 2
    shadow_color: str = "#000000"
    shadow_offset: int = 2
    position: str = "bottom"  # bottom, top, middle
    alignment: str = "center"  # center, left, right
    highlight_active_word: bool = False

class ExportRequest(BaseModel):
    format: str = Field(..., description="srt, vtt, txt, mp4_rendered, mp4_hardcoded, mp4_soft")
    resolution: Optional[str] = "1080p"  # 720p, 1080p
    styling: Optional[SubtitleStylingConfig] = None
    hardcode_subtitles: bool = True

class ExportJobResponse(BaseModel):
    id: str
    project_id: str
    export_format: str
    status: str
    progress: float
    output_filename: Optional[str] = None
    file_size: int = 0
    error_message: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    download_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# --- Timeline Validation ---
class TimelineIssue(BaseModel):
    cue_id: str
    sequence_number: int
    issue_type: str  # overlap, negative_duration, too_short, too_long, text_empty, line_too_long
    severity: str    # error, warning
    message: str

class TimelineValidationResponse(BaseModel):
    is_valid: bool
    issue_count: int
    issues: List[TimelineIssue]
