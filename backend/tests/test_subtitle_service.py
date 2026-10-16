import pytest
from app.services.subtitle_service import (
    ms_to_srt_timestamp,
    ms_to_vtt_timestamp,
    srt_timestamp_to_ms,
    format_cues_to_srt,
    format_cues_to_vtt,
    validate_timeline
)
from app.schemas.schemas import SubtitleCueCreate

class DummyCue:
    def __init__(self, id, seq, start, end, src, sin):
        self.id = id
        self.sequence_number = seq
        self.start_time = start
        self.end_time = end
        self.source_text = src
        self.sinhala_text = sin

def test_timestamp_conversions():
    # 1 hour, 2 minutes, 3 seconds, 456 milliseconds = 3723456 ms
    ms = 3723456
    assert ms_to_srt_timestamp(ms) == "01:02:03,456"
    assert ms_to_vtt_timestamp(ms) == "01:02:03.456"
    assert srt_timestamp_to_ms("01:02:03,456") == ms
    assert srt_timestamp_to_ms("01:02:03.456") == ms

def test_format_cues_to_srt_sinhala_unicode():
    cues = [
        DummyCue("1", 1, 1000, 3500, "Hello world", "ආයුබෝවන් ලෝකය"),
        DummyCue("2", 2, 4000, 7200, "Welcome everyone", "සියලු දෙනා සාදරයෙන් පිළිගනිමු")
    ]
    srt = format_cues_to_srt(cues, use_sinhala=True)
    assert "1" in srt
    assert "00:00:01,000 --> 00:00:03,500" in srt
    assert "ආයුබෝවන් ලෝකය" in srt
    assert "2" in srt
    assert "00:00:04,000 --> 00:00:07,200" in srt
    assert "සියලු දෙනා සාදරයෙන් පිළිගනිමු" in srt

def test_format_cues_to_vtt():
    cues = [
        DummyCue("1", 1, 500, 2500, "Testing VTT", "පරීක්ෂා කිරීම")
    ]
    vtt = format_cues_to_vtt(cues, use_sinhala=True)
    assert vtt.startswith("WEBVTT")
    assert "00:00:00.500 --> 00:00:02.500" in vtt
    assert "පරීක්ෂා කිරීම" in vtt

def test_validate_timeline_overlap():
    cues = [
        DummyCue("1", 1, 1000, 3000, "One", "එක"),
        DummyCue("2", 2, 2500, 5000, "Two", "දෙක")  # Overlaps by 500ms
    ]
    val = validate_timeline(cues)
    assert not val.is_valid
    assert any(i.issue_type == "overlap" for i in val.issues)

def test_validate_timeline_duration():
    cues = [
        DummyCue("1", 1, 1000, 1100, "Short", "කෙටි")  # Only 100ms
    ]
    val = validate_timeline(cues)
    assert any(i.issue_type == "too_short" for i in val.issues)
