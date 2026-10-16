import pytest
from app.services.segmentation_service import wrap_text_into_lines, segment_transcription

def test_wrap_text_into_lines():
    text = "This is a simple sentence that should wrap neatly into two lines without breaking any words."
    wrapped = wrap_text_into_lines(text, max_chars_per_line=30, max_lines=2)
    lines = wrapped.split("\n")
    assert len(lines) <= 2
    for line in lines:
        assert len(line) > 0

def test_segment_transcription():
    raw_segments = [
        {"start": 1.0, "end": 4.5, "text": "Welcome to our presentation today."},
        {"start": 5.0, "end": 14.0, "text": "This is a very long segment that definitely exceeds the maximum recommended duration for a single subtitle cue and therefore must be split into multiple balanced phrases."}
    ]
    cues = segment_transcription(raw_segments, max_chars_per_line=40, max_lines=2, max_cue_duration_ms=6000)
    assert len(cues) >= 2
    for cue in cues:
        assert cue["end_time"] > cue["start_time"]
        assert len(cue["source_text"]) > 0

def test_no_overlapping_timestamps():
    raw_segments = [
        {"start": 1.0, "end": 3.0, "text": "First phrase"},
        {"start": 2.5, "end": 5.0, "text": "Second phrase overlapping"}
    ]
    cues = segment_transcription(raw_segments)
    for i in range(1, len(cues)):
        assert cues[i]["start_time"] >= cues[i-1]["end_time"]
