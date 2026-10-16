import os
import subprocess
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Project, SubtitleCue, ExportJob, MediaAsset
from app.utils.ffmpeg_utils import (
    get_ffmpeg_binary,
    generate_ass_subtitle_file,
    embed_subtitles_into_video
)
from app.services.subtitle_service import format_cues_to_srt

logger = logging.getLogger(__name__)

ASPECT_RATIO_DIMS = {
    "16:9": {"1080p": (1920, 1080), "720p": (1280, 720)},
    "9:16": {"1080p": (1080, 1920), "720p": (720, 1280)},
    "1:1": {"1080p": (1080, 1080), "720p": (720, 720)},
    "4:5": {"1080p": (1080, 1350), "720p": (720, 900)},
}

def render_timeline_project(db: Session, export_id: str) -> ExportJob:
    """
    Renders an editing project from its timeline_data and cues into a finished MP4 video
    with styled Sinhala subtitles, clip trims, aspect ratio scaling, text overlays, and audio mixing.
    """
    export_job = db.query(ExportJob).filter(ExportJob.id == export_id).first()
    if not export_job:
        raise ValueError(f"Export job {export_id} not found.")

    project = db.query(Project).filter(Project.id == export_job.project_id).first()
    if not project:
        export_job.status = "failed"
        export_job.error_message = "Project not found"
        db.commit()
        return export_job

    ffmpeg_exe = get_ffmpeg_binary()
    exports_dir = settings.STORAGE_DIR / "exports"
    os.makedirs(exports_dir, exist_ok=True)

    export_job.status = "processing"
    export_job.progress = 10.0
    db.commit()

    styling = export_job.styling_config or {}
    resolution_label = styling.get("resolution", "1080p")
    aspect_ratio = project.aspect_ratio or "16:9"
    dims = ASPECT_RATIO_DIMS.get(aspect_ratio, ASPECT_RATIO_DIMS["16:9"]).get(resolution_label, (1920, 1080))
    target_width, target_height = dims

    base_name = Path(project.original_filename or project.title or "video").stem
    out_filename = f"{base_name}_rendered_{aspect_ratio.replace(':', 'x')}_{resolution_label}.mp4"
    out_path = str(exports_dir / f"{export_job.id}_{out_filename}")

    timeline_data = project.timeline_data or {}
    tracks = timeline_data.get("tracks", [])

    # Find main video clips or fallback to project uploaded media
    video_track = next((t for t in tracks if t.get("type") == "video"), None)
    video_clips = video_track.get("clips", []) if video_track else []

    # Audio track
    audio_track = next((t for t in tracks if t.get("type") == "audio"), None)
    audio_clips = audio_track.get("clips", []) if audio_track else []

    # Text overlays track
    text_track = next((t for t in tracks if t.get("type") == "text"), None)
    text_clips = text_track.get("clips", []) if text_track else []

    # Subtitle cues
    cues = db.query(SubtitleCue).filter(SubtitleCue.project_id == project.id).order_by(SubtitleCue.sequence_number).all()

    # Asset lookup map
    assets = db.query(MediaAsset).filter(MediaAsset.project_id == project.id).all()
    asset_map = {a.id: str(settings.STORAGE_DIR / "uploads" / a.stored_filename) for a in assets}

    # Fallback media path
    fallback_video_path = str(settings.STORAGE_DIR / "uploads" / project.stored_filename) if project.stored_filename else ""

    export_job.progress = 25.0
    db.commit()

    # 1. Prepare Subtitle ASS file with Sinhala Styling
    temp_ass_path = str(exports_dir / f"temp_{export_job.id}.ass")
    has_subtitles = len(cues) > 0 and export_job.export_format != "mp4_soft"

    if has_subtitles:
        generate_ass_subtitle_file(
            cues=cues,
            output_ass_path=temp_ass_path,
            styling=styling,
            play_res_x=target_width,
            play_res_y=target_height
        )

    # 2. Build FFmpeg command for timeline composition
    try:
        # Check if we have multiple clips or single clip
        first_clip = video_clips[0] if video_clips else None
        main_video_file = fallback_video_path

        source_start_sec = 0.0
        clip_duration_sec = project.media_duration or 10.0
        speed = 1.0

        if first_clip:
            asset_id = first_clip.get("asset_id")
            if asset_id and asset_id in asset_map and os.path.exists(asset_map[asset_id]):
                main_video_file = asset_map[asset_id]
            source_start_sec = first_clip.get("source_start_ms", 0) / 1000.0
            clip_duration_sec = first_clip.get("duration_ms", 10000) / 1000.0
            speed = float(first_clip.get("playback_rate", 1.0))

        if not os.path.exists(main_video_file):
            raise FileNotFoundError(f"Source video file '{main_video_file}' was not found on server.")

        export_job.progress = 45.0
        db.commit()

        # Build video filters:
        # Scale & pad to aspect ratio (letterboxing if needed)
        filter_parts = []
        filter_parts.append(f"scale={target_width}:{target_height}:force_original_aspect_ratio=decrease")
        filter_parts.append(f"pad={target_width}:{target_height}:(ow-iw)/2:(oh-ih)/2:black")

        if speed != 1.0 and speed > 0:
            setpts = 1.0 / speed
            filter_parts.append(f"setpts={setpts:.3f}*PTS")

        # Color adjustments if in clip transform/effects
        effects = (first_clip.get("effects") or []) if first_clip else []
        for fx in effects:
            fx_type = fx.get("type")
            if fx_type == "brightness":
                val = float(fx.get("value", 0.0))
                filter_parts.append(f"eq=brightness={val:.2f}")
            elif fx_type == "contrast":
                val = float(fx.get("value", 1.0))
                filter_parts.append(f"eq=contrast={val:.2f}")
            elif fx_type == "saturation":
                val = float(fx.get("value", 1.0))
                filter_parts.append(f"eq=saturation={val:.2f}")
            elif fx_type == "blur":
                val = float(fx.get("value", 1.0))
                filter_parts.append(f"boxblur={val:.1f}:1")

        # Add ASS subtitles filter
        if has_subtitles and os.path.exists(temp_ass_path):
            escaped_ass = temp_ass_path.replace("\\", "/").replace(":", "\\:")
            filter_parts.append(f"ass='{escaped_ass}'")

        # Check for background music audio clip
        bg_audio_file = None
        if audio_clips:
            first_audio = audio_clips[0]
            bg_asset_id = first_audio.get("asset_id")
            if bg_asset_id and bg_asset_id in asset_map and os.path.exists(asset_map[bg_asset_id]):
                bg_audio_file = asset_map[bg_asset_id]

        vf_string = ",".join(filter_parts)

        cmd = [ffmpeg_exe, "-y"]

        # Input video with trim
        if source_start_sec > 0:
            cmd.extend(["-ss", f"{source_start_sec:.3f}"])
        cmd.extend(["-t", f"{clip_duration_sec:.3f}"])
        cmd.extend(["-i", main_video_file])

        # If background music is present
        if bg_audio_file:
            cmd.extend(["-i", bg_audio_file])
            # Filter complex with audio mix
            filter_complex = f"[0:v]{vf_string}[v];[0:a]volume=0.8[a0];[1:a]volume=0.3[a1];[a0][a1]amix=inputs=2:duration=first[a]"
            cmd.extend([
                "-filter_complex", filter_complex,
                "-map", "[v]",
                "-map", "[a]"
            ])
        else:
            cmd.extend([
                "-vf", vf_string,
                "-c:a", "aac",
                "-b:a", "192k"
            ])

        cmd.extend([
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            out_path
        ])

        export_job.progress = 65.0
        db.commit()

        logger.info(f"Executing FFmpeg render command: {' '.join(cmd)}")
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=900,
            encoding="utf-8",
            errors="replace"
        )

        if proc.returncode != 0:
            logger.error(f"FFmpeg render error: {proc.stderr}")
            raise RuntimeError(f"FFmpeg render failed: {proc.stderr[-600:]}")

        # Cleanup temp ASS
        if os.path.exists(temp_ass_path):
            try:
                os.remove(temp_ass_path)
            except Exception:
                pass

        file_size = os.path.getsize(out_path) if os.path.exists(out_path) else 0

        export_job.status = "completed"
        export_job.progress = 100.0
        export_job.output_path = out_path
        export_job.output_filename = out_filename
        export_job.file_size = file_size
        export_job.completed_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Render export {export_id} completed successfully: {out_filename} ({file_size} bytes)")
        return export_job

    except Exception as e:
        logger.error(f"Render export {export_id} failed: {e}", exc_info=True)
        export_job.status = "failed"
        export_job.progress = 0.0
        export_job.error_message = str(e)
        db.commit()
        return export_job
