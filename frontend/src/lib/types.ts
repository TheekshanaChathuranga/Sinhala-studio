export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5';

export interface MediaAsset {
  id: string;
  project_id: string;
  name: string;
  stored_filename: string;
  asset_type: 'video' | 'audio' | 'image';
  duration: number; // seconds
  width: number;
  height: number;
  fps: number;
  file_size: number;
  thumbnail_url?: string | null;
  media_url?: string | null;
  created_at: string;
}

export interface ClipTransform {
  scale: number;
  x: number;
  y: number;
  rotation: number;
  opacity: number;
}

export interface ClipEffect {
  type: 'brightness' | 'contrast' | 'saturation' | 'blur';
  value: number;
}

export interface TextOverlaySettings {
  content: string;
  font_name: string;
  font_size: number;
  text_color: string;
  background_color: string;
  background_opacity: number;
  outline_color: string;
  outline_width: number;
  shadow_color: string;
  shadow_offset: number;
  animation: 'none' | 'fade' | 'slide_up' | 'pop';
  position_x: number; // 0.0 - 1.0 (center is 0.5)
  position_y: number; // 0.0 - 1.0 (center is 0.5)
}

export interface TimelineClip {
  id: string;
  asset_id?: string;
  type: 'video' | 'image' | 'audio' | 'text' | 'subtitle';
  name: string;
  timeline_start_ms: number;
  duration_ms: number;
  source_start_ms: number;
  source_end_ms: number;
  playback_rate: number;
  volume: number;
  transform?: ClipTransform;
  effects?: ClipEffect[];
  text_settings?: TextOverlaySettings;
}

export interface TimelineTrack {
  id: string;
  type: 'video' | 'overlay' | 'text' | 'subtitle' | 'audio';
  name: string;
  order: number;
  muted: boolean;
  visible: boolean;
  locked: boolean;
  clips: TimelineClip[];
}

export interface TimelineData {
  aspect_ratio: AspectRatio;
  duration_ms: number;
  tracks: TimelineTrack[];
  subtitle_styling?: SubtitleStyling;
}

export interface SubtitleStyling {
  preset_name?: string;
  font_size: number;
  font_name: string;
  text_color: string;
  background_color: string;
  background_opacity: number;
  outline_color: string;
  outline_width: number;
  shadow_color: string;
  shadow_offset: number;
  position: 'bottom' | 'top' | 'middle';
  alignment: 'center' | 'left' | 'right';
  highlight_active_word?: boolean;
}

export interface SubtitleCue {
  id: string;
  project_id: string;
  sequence_number: number;
  start_time: number; // ms
  end_time: number; // ms
  source_text: string;
  sinhala_text: string;
  speaker?: string | null;
  confidence?: number | null;
  is_edited: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProcessingJob {
  id: string;
  project_id: string;
  job_type: string;
  current_stage: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage_message?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface Project {
  id: string;
  title?: string | null;
  original_filename: string;
  stored_filename: string;
  media_type: string;
  media_duration: number;
  file_size: number;
  aspect_ratio: AspectRatio;
  timeline_data?: TimelineData | null;
  source_language: string;
  detected_language?: string | null;
  target_language: string;
  translation_style: string;
  preserve_technical_terms: boolean;
  status: string;
  created_at: string;
  updated_at: string;
  cues: SubtitleCue[];
  assets: MediaAsset[];
  latest_job?: ProcessingJob | null;
}

export interface ProjectListItem {
  id: string;
  title?: string | null;
  original_filename: string;
  media_type: string;
  media_duration: number;
  file_size: number;
  aspect_ratio: AspectRatio;
  source_language: string;
  detected_language?: string | null;
  target_language: string;
  status: string;
  cue_count: number;
  created_at: string;
  updated_at: string;
}

export interface TimelineIssue {
  cue_id: string;
  sequence_number: number;
  issue_type: 'overlap' | 'negative_duration' | 'too_short' | 'too_long' | 'text_empty' | 'line_too_long';
  severity: 'error' | 'warning';
  message: string;
}

export interface TimelineValidation {
  is_valid: boolean;
  issue_count: number;
  issues: TimelineIssue[];
}

export interface ExportJob {
  id: string;
  project_id: string;
  export_format: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  output_filename?: string | null;
  file_size: number;
  error_message?: string | null;
  download_url?: string | null;
  created_at: string;
  completed_at?: string | null;
}
