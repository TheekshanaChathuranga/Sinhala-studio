import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"

def test_create_and_get_project():
    payload = {
        "title": "Test Documentary",
        "source_language": "en",
        "target_language": "si",
        "translation_style": "conversational",
        "preserve_technical_terms": True
    }
    create_resp = client.post("/api/v1/projects", json=payload)
    assert create_resp.status_code == 201
    proj_data = create_resp.json()
    project_id = proj_data["id"]
    assert proj_data["title"] == "Test Documentary"
    assert proj_data["status"] == "created"

    # Get project
    get_resp = client.get(f"/api/v1/projects/{project_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == project_id

def test_add_and_update_cue():
    # Create project first
    proj_resp = client.post("/api/v1/projects", json={"title": "Cue Test Project"})
    project_id = proj_resp.json()["id"]

    # Add cue
    cue_payload = {
        "sequence_number": 1,
        "start_time": 1000,
        "end_time": 3000,
        "source_text": "Good morning",
        "sinhala_text": "සුබ උදෑසනක්"
    }
    cue_resp = client.post(f"/api/v1/projects/{project_id}/subtitles", json=cue_payload)
    assert cue_resp.status_code == 201
    cue_data = cue_resp.json()
    cue_id = cue_data["id"]
    assert cue_data["sinhala_text"] == "සුබ උදෑසනක්"

    # Update cue
    update_payload = {
        "sinhala_text": "සුබ උදෑසනක් වේවා!"
    }
    update_resp = client.patch(f"/api/v1/projects/{project_id}/subtitles/{cue_id}", json=update_payload)
    assert update_resp.status_code == 200
    assert update_resp.json()["sinhala_text"] == "සුබ උදෑසනක් වේවා!"

    # Export SRT
    export_resp = client.post(f"/api/v1/projects/{project_id}/export", json={"format": "srt"})
    assert export_resp.status_code == 202
    exp_data = export_resp.json()
    assert exp_data["status"] == "completed"
    assert "download_url" in exp_data

    # Download SRT
    dl_resp = client.get(exp_data["download_url"])
    assert dl_resp.status_code == 200
    assert "සුබ උදෑසනක් වේවා!" in dl_resp.text
