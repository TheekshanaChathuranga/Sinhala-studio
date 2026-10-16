import os
import re
import json
import shutil
import subprocess
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)

_FFMPEG_PATH: Optional[str] = None

def get_ffmpeg_binary() -> str:
    """Resolve the path to the ffmpeg executable safely."""
    global _FFMPEG_PATH
    if _FFMPEG_PATH and os.path.exists(_FFMPEG_PATH):
        return _FFMPEG_PATH

    # 1. Environment setting
    env_ffmpeg = os.getenv("FFMPEG_BINARY")
    if env_ffmpeg and os.path.exists(env_ffmpeg):
        _FFMPEG_PATH = env_ffmpeg
        return _FFMPEG_PATH

    # 2. System PATH
    sys_ffmpeg = shutil.which("ffmpeg")
    if sys_ffmpeg:
        _FFMPEG_PATH = sys_ffmpeg
        return _FFMPEG_PATH

    # 3. imageio_ffmpeg bundled binary
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            _FFMPEG_PATH = exe
            return _FFMPEG_PATH
    except Exception as e:
        logger.warning(f"Failed to resolve ffmpeg via imageio_ffmpeg: {e}")

    raise RuntimeError("FFmpeg executable could not be found. Please ensure FFmpeg or imageio-ffmpeg is installed.")


def extract_media_metadata(file_path: str) -> Dict[str, Any]:
    """
    Extract media information (duration, has_audio, has_video, resolution, fps)
    using ffmpeg banner/stderr output.
    """
    ffmpeg_exe = get_ffmpeg_binary()
    cmd = [ffmpeg_exe, "-hide_banner", "-i", file_path]
    
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=15,
            encoding="utf-8",
            errors="replace"
        )
        stderr = proc.stderr

        duration_sec = 0.0
        dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)", stderr)
        if dur_match:
            hours = float(dur_match.group(1))
            minutes = float(dur_match.group(2))
            seconds = float(dur_match.group(3))
            duration_sec = hours * 3600 + minutes * 60 + seconds

        has_video = bool(re.search(r"Stream #\d+:\d+.*Video:", stderr))
        has_audio = bool(re.search(r"Stream #\d+:\d+.*Audio:", stderr))

        width = 0
        height = 0
        res_match = re.search(r"Video:.*,\s*(\d{2,5})x(\d{2,5})", stderr)
        if res_match:
            width = int(res_match.group(1))
            height = int(res_match.group(2))

        fps = 30.0
        fps_match = re.search(r"(\d+(?:\.\d+)?)\s*fps", stderr)
        if fps_match:
            fps = float(fps_match.group(1))

        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0

        return {
            "duration": round(duration_sec, 2),
            "has_video": has_video,
            "has_audio": has_audio,
            "width": width,
            "height": height,
            "fps": fps,
            "file_size": file_size
        }
    except Exception as e:
        logger.error(f"Error extracting metadata from {file_path}: {e}")
        return {
            "duration": 0.0,
            "has_video": False,
            "has_audio": True,
            "width": 0,
            "height": 0,
            "fps": 30.0,
            "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else 0
        }


def generate_thumbnail(media_path: str, thumbnail_path: str, time_sec: float = 1.0) -> str:
    """Generate a JPEG thumbnail image from a video file."""
    ffmpeg_exe = get_ffmpeg_binary()
    os.makedirs(os.path.dirname(thumbnail_path), exist_ok=True)

    cmd = [
        ffmpeg_exe,
        "-y",
        "-ss", str(time_sec),
        "-i", media_path,
        "-vframes", "1",
        "-q:v", "3",
        "-vf", "scale=480:-1",
        thumbnail_path
    ]

    subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=15,
        encoding="utf-8",
        errors="replace"
    )

    return thumbnail_path if os.path.exists(thumbnail_path) else ""


def extract_audio_to_wav(input_media_path: str, output_wav_path: str) -> str:
    """
    Extracts audio stream from input video/audio file into a standardized
    16kHz 16-bit mono PCM WAV file optimal for Whisper ASR.
    """
    ffmpeg_exe = get_ffmpeg_binary()
    output_dir = os.path.dirname(output_wav_path)
    os.makedirs(output_dir, exist_ok=True)

    cmd = [
        ffmpeg_exe,
        "-y",
        "-i", input_media_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        output_wav_path
    ]

    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=300,
        encoding="utf-8",
        errors="replace"
    )

    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg audio extraction failed (exit code {result.returncode}): {result.stderr}")

    return output_wav_path


def hex_to_ass_color(hex_color: str, alpha: float = 1.0) -> str:
    """
    Convert #RRGGBB and alpha (0.0 - 1.0) into ASS &HAABBGGRR format.
    ASS alpha: 00 = completely opaque, FF = fully transparent.
    """
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
    else:
        r, g, b = "FF", "FF", "FF"

    # Calculate ASS alpha byte (inverted: 0 is opaque)
    alpha_int = int((1.0 - alpha) * 255)
    alpha_hex = f"{max(0, min(255, alpha_int)):02X}"

    return f"&H{alpha_hex}{b}{g}{r}"


def ms_to_ass_time(ms: int) -> str:
    """Format ms to H:MM:SS.cs for ASS subtitles."""
    if ms < 0:
        ms = 0
    hours = ms // 3600000
    minutes = (ms % 3600000) // 60000
    seconds = (ms % 60000) // 1000
    centis = (ms % 1000) // 10
    return f"{hours}:{minutes:02d}:{seconds:02d}.{centis:02d}"


def generate_ass_subtitle_file(
    cues: List[Any],
    output_ass_path: str,
    styling: Dict[str, Any],
    play_res_x: int = 1920,
    play_res_y: int = 1080
) -> str:
    """
    Generates an Advanced SubStation Alpha (.ass) subtitle file.
    Supports Sinhala Unicode, custom fonts, colors, outlines, box backgrounds, and positions.
    """
    os.makedirs(os.path.dirname(output_ass_path), exist_ok=True)

    font_name = styling.get("font_name", "Noto Sans Sinhala")
    font_size = int(styling.get("font_size", 28))
    text_color = styling.get("text_color", "#FFFFFF")
    outline_color = styling.get("outline_color", "#000000")
    outline_width = int(styling.get("outline_width", 2))
    bg_opacity = float(styling.get("background_opacity", 0.6))
    bg_color = styling.get("background_color", "#000000")
    position = styling.get("position", "bottom")
    alignment = styling.get("alignment", "center")

    # Alignment codes in ASS numpad:
    # 2 = bottom-center, 1 = bottom-left, 3 = bottom-right
    # 5 = mid-center, 4 = mid-left, 6 = mid-right
    # 8 = top-center, 7 = top-left, 9 = top-right
    align_code = 2
    if position == "top":
        align_code = 7 if alignment == "left" else (9 if alignment == "right" else 8)
    elif position == "middle":
        align_code = 4 if alignment == "left" else (6 if alignment == "right" else 5)
    else:  # bottom
        align_code = 1 if alignment == "left" else (3 if alignment == "right" else 2)

    primary_color_ass = hex_to_ass_color(text_color, 1.0)
    outline_color_ass = hex_to_ass_color(outline_color, 1.0)
    box_color_ass = hex_to_ass_color(bg_color, bg_opacity)

    # BorderStyle: 1 = Outline + drop shadow, 3 = Opaque box background
    border_style = 3 if bg_opacity > 0.1 else 1

    header = f"""[Script Info]
Title: Sinhala Studio Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: {play_res_x}
PlayResY: {play_res_y}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SinhalaStyle,{font_name},{font_size},{primary_color_ass},&H000000FF,{outline_color_ass},{box_color_ass},1,0,0,0,100,100,0,0,{border_style},{outline_width},1,{align_code},60,60,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    for cue in cues:
        start_ms = getattr(cue, "start_time", 0) if not isinstance(cue, dict) else cue.get("start_time", 0)
        end_ms = getattr(cue, "end_time", 0) if not isinstance(cue, dict) else cue.get("end_time", 0)
        text = getattr(cue, "sinhala_text", "") if not isinstance(cue, dict) else cue.get("sinhala_text", "")
        if not text:
            text = getattr(cue, "source_text", "") if not isinstance(cue, dict) else cue.get("source_text", "")

        text_clean = text.strip().replace("\n", "\\N")
        start_ass = ms_to_ass_time(start_ms)
        end_ass = ms_to_ass_time(max(end_ms, start_ms + 400))

        events.append(f"Dialogue: 0,{start_ass},{end_ass},SinhalaStyle,,0,0,0,,{text_clean}")

    with open(output_ass_path, "w", encoding="utf-8") as f:
        f.write(header + "\n".join(events) + "\n")

    return output_ass_path


def embed_subtitles_into_video(
    video_path: str,
    subtitle_srt_path: str,
    output_video_path: str,
    burn_in: bool = True,
    font_name: str = "Noto Sans Sinhala",
    font_size: int = 24
) -> str:
    """Embed subtitles into video using FFmpeg."""
    ffmpeg_exe = get_ffmpeg_binary()
    os.makedirs(os.path.dirname(output_video_path), exist_ok=True)

    if burn_in:
        escaped_srt = subtitle_srt_path.replace("\\", "/").replace(":", "\\:")
        style_param = f"FontName={font_name},FontSize={font_size},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=3,Outline=2"
        vf_arg = f"subtitles='{escaped_srt}':force_style='{style_param}'"

        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", video_path,
            "-vf", vf_arg,
            "-c:a", "copy",
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "22",
            output_video_path
        ]
    else:
        cmd = [
            ffmpeg_exe,
            "-y",
            "-i", video_path,
            "-i", subtitle_srt_path,
            "-c:v", "copy",
            "-c:a", "copy",
            "-c:s", "mov_text",
            "-metadata:s:s:0", "language=sin",
            output_video_path
        ]

    proc = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=600,
        encoding="utf-8",
        errors="replace"
    )

    if proc.returncode != 0:
        logger.error(f"FFmpeg subtitle embedding failed: {proc.stderr}")
        raise RuntimeError(f"FFmpeg video processing failed: {proc.stderr[-500:]}")

    return output_video_path
