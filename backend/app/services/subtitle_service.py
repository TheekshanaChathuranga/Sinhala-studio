import re
from typing import List, Dict, Any, Tuple
from app.schemas.schemas import TimelineIssue, TimelineValidationResponse

def ms_to_srt_timestamp(ms: int) -> str:
    """Convert milliseconds into SRT timestamp format: HH:MM:SS,mmm"""
    if ms < 0:
        ms = 0
    hours = ms // 3600000
    minutes = (ms % 3600000) // 60000
    seconds = (ms % 60000) // 1000
    millis = ms % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

def ms_to_vtt_timestamp(ms: int) -> str:
    """Convert milliseconds into WebVTT timestamp format: HH:MM:SS.mmm"""
    if ms < 0:
        ms = 0
    hours = ms // 3600000
    minutes = (ms % 3600000) // 60000
    seconds = (ms % 60000) // 1000
    millis = ms % 1000
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"

def srt_timestamp_to_ms(ts: str) -> int:
    """Convert HH:MM:SS,mmm or HH:MM:SS.mmm to milliseconds"""
    ts = ts.strip().replace(",", ".")
    parts = ts.split(":")
    if len(parts) == 3:
        h, m, s = parts
        sec_parts = s.split(".")
        seconds = int(sec_parts[0])
        millis = int(sec_parts[1].ljust(3, "0")[:3]) if len(sec_parts) > 1 else 0
        return int(h) * 3600000 + int(m) * 60000 + seconds * 1000 + millis
    elif len(parts) == 2:
        m, s = parts
        sec_parts = s.split(".")
        seconds = int(sec_parts[0])
        millis = int(sec_parts[1].ljust(3, "0")[:3]) if len(sec_parts) > 1 else 0
        return int(m) * 60000 + seconds * 1000 + millis
    return 0

def format_cues_to_srt(cues: List[Any], use_sinhala: bool = True) -> str:
    """
    Generate SubRip (.srt) subtitle string from cues.
    Strictly follows UTF-8 and standard SRT format.
    """
    output_lines = []
    sorted_cues = sorted(cues, key=lambda c: (c.start_time, c.sequence_number))

    for idx, cue in enumerate(sorted_cues, start=1):
        text = cue.sinhala_text if use_sinhala and cue.sinhala_text else (cue.source_text or "")
        text = text.strip()
        
        start_ts = ms_to_srt_timestamp(cue.start_time)
        end_ts = ms_to_srt_timestamp(max(cue.end_time, cue.start_time + 500))

        output_lines.append(str(idx))
        output_lines.append(f"{start_ts} --> {end_ts}")
        output_lines.append(text)
        output_lines.append("")  # Blank line separator

    return "\n".join(output_lines)

def format_cues_to_vtt(cues: List[Any], use_sinhala: bool = True) -> str:
    """
    Generate WebVTT (.vtt) subtitle string from cues.
    """
    output_lines = ["WEBVTT", ""]
    sorted_cues = sorted(cues, key=lambda c: (c.start_time, c.sequence_number))

    for idx, cue in enumerate(sorted_cues, start=1):
        text = cue.sinhala_text if use_sinhala and cue.sinhala_text else (cue.source_text or "")
        text = text.strip()
        
        start_ts = ms_to_vtt_timestamp(cue.start_time)
        end_ts = ms_to_vtt_timestamp(max(cue.end_time, cue.start_time + 500))

        output_lines.append(f"{idx}")
        output_lines.append(f"{start_ts} --> {end_ts}")
        output_lines.append(text)
        output_lines.append("")

    return "\n".join(output_lines)

def format_cues_to_txt(cues: List[Any], include_timestamps: bool = True, use_sinhala: bool = True) -> str:
    """
    Generate plain text transcript from cues.
    """
    output_lines = []
    sorted_cues = sorted(cues, key=lambda c: (c.start_time, c.sequence_number))

    for cue in sorted_cues:
        text = cue.sinhala_text if use_sinhala and cue.sinhala_text else (cue.source_text or "")
        text = text.strip()
        if not text:
            continue

        if include_timestamps:
            start_ts = ms_to_srt_timestamp(cue.start_time)
            output_lines.append(f"[{start_ts}] {text}")
        else:
            output_lines.append(text)

    return "\n".join(output_lines)

def validate_timeline(cues: List[Any]) -> TimelineValidationResponse:
    """
    Validate subtitle timeline for overlaps, invalid durations, empty texts, and line lengths.
    """
    issues: List[TimelineIssue] = []
    sorted_cues = sorted(cues, key=lambda c: c.start_time)

    for i, cue in enumerate(sorted_cues):
        cue_id = getattr(cue, "id", str(i + 1))
        seq = getattr(cue, "sequence_number", i + 1)
        start = cue.start_time
        end = cue.end_time
        duration = end - start
        sinhala_text = getattr(cue, "sinhala_text", "") or ""

        # Check negative / zero duration
        if duration <= 0:
            issues.append(TimelineIssue(
                cue_id=cue_id,
                sequence_number=seq,
                issue_type="negative_duration",
                severity="error",
                message=f"Subtitle #{seq} has invalid duration ({duration}ms). End time must be after start time."
            ))
        elif duration < 400:
            issues.append(TimelineIssue(
                cue_id=cue_id,
                sequence_number=seq,
                issue_type="too_short",
                severity="warning",
                message=f"Subtitle #{seq} duration is very short ({duration}ms < 400ms)."
            ))
        elif duration > 8000:
            issues.append(TimelineIssue(
                cue_id=cue_id,
                sequence_number=seq,
                issue_type="too_long",
                severity="warning",
                message=f"Subtitle #{seq} duration is unusually long ({duration/1000:.1f}s > 8s)."
            ))

        # Check empty text
        if not sinhala_text.strip():
            issues.append(TimelineIssue(
                cue_id=cue_id,
                sequence_number=seq,
                issue_type="text_empty",
                severity="warning",
                message=f"Subtitle #{seq} text is empty."
            ))
        else:
            # Check line length (recommend max 45 chars per line)
            lines = sinhala_text.strip().split("\n")
            for line_idx, line in enumerate(lines, 1):
                if len(line.strip()) > 50:
                    issues.append(TimelineIssue(
                        cue_id=cue_id,
                        sequence_number=seq,
                        issue_type="line_too_long",
                        severity="warning",
                        message=f"Subtitle #{seq} line {line_idx} is long ({len(line.strip())} chars > 50 chars). Consider splitting."
                    ))

        # Check overlap with previous cue
        if i > 0:
            prev_cue = sorted_cues[i - 1]
            if start < prev_cue.end_time:
                overlap_ms = prev_cue.end_time - start
                issues.append(TimelineIssue(
                    cue_id=cue_id,
                    sequence_number=seq,
                    issue_type="overlap",
                    severity="error",
                    message=f"Subtitle #{seq} overlaps with subtitle #{prev_cue.sequence_number} by {overlap_ms}ms."
                ))

    return TimelineValidationResponse(
        is_valid=not any(issue.severity == "error" for issue in issues),
        issue_count=len(issues),
        issues=issues
    )
