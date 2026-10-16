import re
from typing import List, Dict, Any, Optional

def wrap_text_into_lines(text: str, max_chars_per_line: int = 42, max_lines: int = 2) -> str:
    """
    Wrap text into natural lines without splitting words.
    """
    words = text.strip().split()
    if not words:
        return ""

    lines = []
    current_line = []
    current_len = 0

    for word in words:
        word_len = len(word)
        if current_line and (current_len + 1 + word_len > max_chars_per_line):
            lines.append(" ".join(current_line))
            current_line = [word]
            current_len = word_len
        else:
            current_line.append(word)
            current_len += (1 if current_len > 0 else 0) + word_len

    if current_line:
        lines.append(" ".join(current_line))

    # If lines exceed max_lines, compact them
    if len(lines) > max_lines:
        first_lines = lines[:max_lines - 1]
        remaining = " ".join(lines[max_lines - 1:])
        return "\n".join(first_lines + [remaining])

    return "\n".join(lines)


def segment_transcription(
    raw_segments: List[Dict[str, Any]],
    max_chars_per_line: int = 42,
    max_lines: int = 2,
    min_cue_duration_ms: int = 800,
    max_cue_duration_ms: int = 7000
) -> List[Dict[str, Any]]:
    """
    Process raw ASR speech segments into properly timed, non-overlapping subtitle cues.
    
    Each segment dictionary in input contains:
    - start: float (seconds)
    - end: float (seconds)
    - text: str
    - words: optional list of dicts with {word, start, end}
    """
    cues = []
    max_cue_chars = max_chars_per_line * max_lines

    for seg in raw_segments:
        text = seg.get("text", "").strip()
        if not text:
            continue

        start_ms = int(round(seg.get("start", 0.0) * 1000))
        end_ms = int(round(seg.get("end", 0.0) * 1000))
        duration_ms = end_ms - start_ms

        if duration_ms < min_cue_duration_ms:
            end_ms = start_ms + min_cue_duration_ms
            duration_ms = min_cue_duration_ms

        # If segment is too long in duration or characters, split it
        if duration_ms > max_cue_duration_ms or len(text) > max_cue_chars:
            # Try splitting by sentence or clause punctuation
            chunks = re.split(r'([.?!,;—]+|\s+(?:and|or|but|because|so|that|නම්|සහ|හා|නමුත්)\s+)', text)
            combined_chunks = []
            buf = ""
            for ch in chunks:
                if not ch:
                    continue
                if re.match(r'^[.?!,;—]+$', ch.strip()) or ch.strip() in ['නම්', 'සහ', 'හා', 'නමුත්', 'and', 'or', 'but']:
                    buf += ch
                else:
                    if buf:
                        combined_chunks.append(buf.strip())
                    buf = ch
            if buf:
                combined_chunks.append(buf.strip())

            # If no meaningful punctuation found, split evenly by word count
            if len(combined_chunks) <= 1:
                words = text.split()
                mid = len(words) // 2
                if mid > 0:
                    combined_chunks = [" ".join(words[:mid]), " ".join(words[mid:])]
                else:
                    combined_chunks = [text]

            # Calculate proportional timestamps
            total_chars = max(sum(len(c) for c in combined_chunks), 1)
            current_start = start_ms

            for i, chunk in enumerate(combined_chunks):
                chunk_text = chunk.strip()
                if not chunk_text:
                    continue
                chunk_proportion = len(chunk_text) / total_chars
                chunk_duration = max(int(duration_ms * chunk_proportion), min_cue_duration_ms)
                chunk_end = current_start + chunk_duration
                if i == len(combined_chunks) - 1:
                    chunk_end = max(end_ms, current_start + min_cue_duration_ms)

                cues.append({
                    "start_time": current_start,
                    "end_time": chunk_end,
                    "source_text": wrap_text_into_lines(chunk_text, max_chars_per_line, max_lines)
                })
                current_start = chunk_end + 50  # 50ms gap
        else:
            cues.append({
                "start_time": start_ms,
                "end_time": end_ms,
                "source_text": wrap_text_into_lines(text, max_chars_per_line, max_lines)
            })

    # Prevent overlapping timestamps
    for i in range(1, len(cues)):
        prev = cues[i - 1]
        curr = cues[i]
        if curr["start_time"] < prev["end_time"]:
            mid_point = (prev["end_time"] + curr["start_time"]) // 2
            if mid_point > prev["start_time"] + 500:
                prev["end_time"] = mid_point - 20
                curr["start_time"] = mid_point
            else:
                curr["start_time"] = prev["end_time"] + 30
                if curr["end_time"] <= curr["start_time"]:
                    curr["end_time"] = curr["start_time"] + min_cue_duration_ms

    # Assign sequence numbers
    for idx, cue in enumerate(cues, start=1):
        cue["sequence_number"] = idx

    return cues
