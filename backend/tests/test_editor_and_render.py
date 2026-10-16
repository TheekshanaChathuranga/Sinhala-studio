import os
import wave
import struct
import math
import subprocess
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.utils.ffmpeg_utils import get_ffmpeg_binary, generate_ass_subtitle_file

client = TestClient(app)

def create_synthetic_test_video(file_path: str, duration_sec: float = 2.0):
    """Generate a minimal valid 1280x720 MP4 test video with audio using FFmpeg."""
    ffmpeg_exe = get_ffmpeg_binary()
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    cmd = [
        ffmpeg_exe,
        "-y",
        "-f", "lavfi",
        "-i", f"testsrc=duration={duration_sec}:size=640x360:rate=30",
        "-f", "lavfi",
        "-i", f"sine=frequency=440:duration={duration_sec}",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        file_path
    ]
    subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
    return file_path


def test_asset_upload_and_thumbnail(tmp_path):
    # 1. Create a project
    res = client.post("/api/v1/projects", json={"title": "Video Editor Test", "aspect_ratio": "9:16"})
    assert res.status_code == 201
    project_id = res.json()["id"]
    assert res.json()["aspect_ratio"] == "9:16"

    # 2. Generate a test video
    video_path = str(tmp_path / "clip.mp4")
    create_synthetic_test_video(video_path, duration_sec=2.0)
    assert os.path.exists(video_path)

    # 3. Upload as asset
    with open(video_path, "rb") as f:
        asset_res = client.post(
            f"/api/v1/projects/{project_id}/assets",
            files={"file": ("clip.mp4", f, "video/mp4")}
        )
    assert asset_res.status_code == 200
    asset_data = asset_res.json()
    assert asset_data["asset_type"] == "video"
    assert asset_data["duration"] > 0
    assert asset_data["thumbnail_url"] is not None

    # 4. Check asset listing
    list_res = client.get(f"/api/v1/projects/{project_id}/assets")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 5. Check timeline update
    timeline_payload = {
        "aspect_ratio": "9:16",
        "timeline_data": {
            "aspect_ratio": "9:16",
            "duration_ms": 2000,
            "tracks": [
                {
                    "id": "track_video",
                    "type": "video",
                    "name": "Main Video",
                    "order": 1,
                    "muted": False,
                    "visible": True,
                    "locked": False,
                    "clips": [
                        {
                            "id": "clip_1",
                            "asset_id": asset_data["id"],
                            "type": "video",
                            "name": "clip.mp4",
                            "timeline_start_ms": 0,
                            "duration_ms": 2000,
                            "source_start_ms": 0,
                            "source_end_ms": 2000,
                            "playback_rate": 1.0,
                            "volume": 1.0
                        }
                    ]
                }
            ]
        }
    }
    put_res = client.put(f"/api/v1/projects/{project_id}/timeline", json=timeline_payload)
    assert put_res.status_code == 200
    assert put_res.json()["timeline_data"]["tracks"][0]["clips"][0]["id"] == "clip_1"


def test_ass_subtitle_generation(tmp_path):
    cues = [
        {"start_time": 500, "end_time": 2500, "sinhala_text": "ආයුබෝවන් සිංහල ස්ටූඩියෝ"}
    ]
    styling = {
        "font_name": "Noto Sans Sinhala",
        "font_size": 32,
        "text_color": "#FFCC00",
        "outline_color": "#000000",
        "background_opacity": 0.7,
        "background_color": "#111111",
        "position": "bottom",
        "alignment": "center"
    }
    ass_path = str(tmp_path / "test.ass")
    generate_ass_subtitle_file(cues, ass_path, styling, play_res_x=1920, play_res_y=1080)
    assert os.path.exists(ass_path)
    content = open(ass_path, "r", encoding="utf-8").read()
    assert "Noto Sans Sinhala" in content
    assert "ආයුබෝවන් සිංහල ස්ටූඩියෝ" in content
    assert "Dialogue:" in content


def test_render_real_video_with_subtitles(tmp_path):
    # 1. Create project
    proj_res = client.post("/api/v1/projects", json={"title": "Render Test Video", "aspect_ratio": "16:9"})
    assert proj_res.status_code == 201
    project_id = proj_res.json()["id"]

    # 2. Upload video
    video_path = str(tmp_path / "render_source.mp4")
    create_synthetic_test_video(video_path, duration_sec=2.0)
    with open(video_path, "rb") as f:
        upload_res = client.post(
            f"/api/v1/projects/{project_id}/upload",
            files={"file": ("render_source.mp4", f, "video/mp4")}
        )
    assert upload_res.status_code == 200

    # 3. Add Sinhala subtitle cue
    cue_res = client.post(
        f"/api/v1/projects/{project_id}/subtitles",
        json={
            "sequence_number": 1,
            "start_time": 200,
            "end_time": 1800,
            "source_text": "Sinhala Video Editor",
            "sinhala_text": "සිංහල වීඩියෝ සංස්කාරකය"
        }
    )
    assert cue_res.status_code == 201

    # 4. Trigger Video Render
    render_req = {
        "format": "mp4_rendered",
        "resolution": "720p",
        "styling": {
            "font_size": 26,
            "font_name": "Noto Sans Sinhala",
            "text_color": "#00FFFF",
            "background_opacity": 0.5,
            "position": "bottom",
            "alignment": "center"
        }
    }
    render_res = client.post(f"/api/v1/projects/{project_id}/render", json=render_req)
    assert render_res.status_code == 202
    export_job = render_res.json()
    assert export_job["status"] in ("queued", "processing", "completed")

    # 5. Check export status and download
    export_id = export_job["id"]
    status_res = client.get(f"/api/v1/exports/{export_id}")
    assert status_res.status_code == 200
    res_data = status_res.json()
    assert res_data["download_url"] is not None
