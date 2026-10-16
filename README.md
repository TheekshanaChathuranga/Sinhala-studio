# Sinhala Studio 🎬🇱🇰
### AI Sinhala Video Editor & Subtitle Platform (CapCut-Style Web Application)

A modern, browser-based nonlinear video editor and AI subtitle studio inspired by **CapCut**. Sinhala Studio enables creators to upload videos and audio, automatically transcribe and translate dialogue into synchronized **Sinhala subtitles** (`si`), edit footage on a multi-track timeline, style text and captions with professional presets, composite video overlays, mix audio tracks, and render finished MP4 videos directly in the cloud.

---

## ✨ Core Features

### 1. 🎞️ Multi-Track Nonlinear Timeline Editor
- **Multi-Track Editing**:
  - **Video & B-Roll Tracks**: Main video and overlay footage.
  - **Text & Title Tracks**: Lower thirds, headline titles, and captions with animation presets.
  - **Sinhala Subtitle Track**: Frame-accurate synchronized subtitle cues with word and phrase alignments.
  - **Multi-Channel Audio Tracks**: Background music, voiceover, and sound effects.
- **Editing Tools**:
  - **Split at Playhead** (`Ctrl+B` / Split button).
  - **Trim Start & End** with millisecond precision.
  - **Clip Movement & Reordering**: Shift clips across the timeline with automatic timebase calculation.
  - **Speed Adjustments**: Slow motion (`0.5x`, `0.75x`), standard (`1.0x`), and fast playback (`1.25x`, `1.5x`, `2.0x`).
  - **Aspect Ratio Canvases**: Instant switching between `16:9` (YouTube / Landscape), `9:16` (TikTok / Shorts / Reels), `1:1` (Square / Feed), and `4:5` (Portrait).
  - **Undo / Redo & Autosave**: Full operation history with automatic background state persistence.

### 2. 🎨 CapCut-Style Subtitle & Text Styling
- **Sinhala Typography**: Complete Sinhala Unicode rendering with Google Fonts *Noto Sans Sinhala*.
- **One-Click Style Presets**:
  - **Classic White**: Crisp white text with subtle shadow.
  - **YouTube Yellow**: High-contrast yellow text with dark outline (`#FFDE00`).
  - **Bold Outline**: White heavy text with a thick black outline.
  - **Dark Box**: Translucent backdrop box for maximum legibility over complex video backgrounds.
  - **Neon Cyan**: Vibrant cyber glow with bright cyan border.
  - **Sinhala Gold**: Warm amber-gold luxury caption style.
- **Advanced SubStation Alpha (ASS) Engine**: Generates `.ass` styling descriptors with accurate font metrics, hex-to-ass color conversion, outline thickness, shadow offset, alignment margins, and bounding box opacity.

### 3. 🤖 AI Speech Recognition & Sinhala Translation Pipeline
- **faster-whisper (CTranslate2)**: High-speed speech-to-text with Voice Activity Detection (VAD) and word-level timestamps. Supports 90+ spoken source languages with automatic detection.
- **Context-Aware Sinhala Translation Engine**:
  - Preserves colloquial Sri Lankan speech phrasing or formal video narration styles.
  - Pluggable providers: LLM (OpenAI / Gemini / Groq / Ollama), Machine Translation, and offline Heuristic Dictionary fallback.
  - Preserves English technical terms and loanwords (*AI*, *Python*, *Internet*).
- **Interactive Subtitle Cue Editor**: In-place Sinhala text editing, split at midpoint, merge adjacent cues, and ±100ms nudging.

### 4. 🚀 Server-Side FFmpeg Multi-Track Rendering Engine
- **Deterministic Cloud Rendering**: Translates the multi-track timeline project into an optimized FFmpeg filtergraph.
- **Layer Compositing**:
  - Clips scaled and letterboxed/pillarboxed to target aspect ratios (`1920x1080`, `1080x1920`, etc.).
  - ASS subtitle burn-in rendered natively with libass and *Noto Sans Sinhala*.
  - Text overlays rendered with font, size, color, and positioning.
  - Multi-track audio mixing with volume attenuation and audio normalization (`amix`).
- **Export Options**:
  - High-definition MP4 video (`1080p` and `720p` H.264 / AAC).
  - Standalone SubRip (`.srt`) download.
  - Standalone WebVTT (`.vtt`) download.
  - Subtitle burn-in toggle.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | Next.js 14+ (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons |
| **Video Canvas** | HTML5 Video & Audio APIs, Dynamic CSS Aspect Ratio Canvases |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy, SQLite / PostgreSQL |
| **Media Processing** | FFmpeg 7.1 (via bundled `imageio-ffmpeg` or system PATH), FFprobe, libass |
| **Speech Recognition** | `faster-whisper` (CTranslate2), PyAV |
| **Translation** | Modular provider (LLM / Free MT / Heuristic Dictionary) |
| **Testing** | Pytest, Pytest-Asyncio, Next.js build verification |

---

## 📁 Repository Structure

```text
sinhala-subtitle-generator/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI application entrypoint
│   │   ├── api/routes/
│   │   │   ├── projects.py             # Projects, assets, timeline autosave, rendering
│   │   │   ├── subtitles.py            # Cue editing, batch update, timeline validation
│   │   │   ├── jobs.py                 # Pipeline progress tracking
│   │   │   └── exports.py              # Export generation & download endpoints
│   │   ├── core/
│   │   │   ├── config.py               # Settings & environment configuration
│   │   │   └── database.py             # SQLAlchemy session & SQLite/Postgres engine
│   │   ├── models/models.py            # Project, MediaAsset, SubtitleCue, ExportJob
│   │   ├── schemas/schemas.py          # Pydantic v2 request/response schemas
│   │   ├── services/
│   │   │   ├── asr_service.py          # faster-whisper ASR & language detection
│   │   │   ├── translation_service.py  # Hybrid Sinhala translation engine
│   │   │   ├── segmentation_service.py # Subtitle line wrapping & timing heuristics
│   │   │   ├── subtitle_service.py     # SRT/VTT formatting & timeline validation
│   │   │   ├── video_render_service.py # FFmpeg multi-track video compositor
│   │   │   ├── export_service.py       # Render dispatcher & file exporter
│   │   │   └── pipeline_orchestrator.py# End-to-end processing pipeline
│   │   └── utils/
│   │       └── ffmpeg_utils.py         # FFmpeg discovery, thumbnails, ASS subtitle generator
│   ├── tests/                          # Automated test suite (17 tests)
│   │   ├── test_api.py                 # REST API endpoints test
│   │   ├── test_editor_and_render.py   # Asset uploads, ASS generation & FFmpeg render
│   │   ├── test_e2e_workflow.py        # End-to-end ASR, translation & export
│   │   ├── test_segmentation.py        # Line wrapping and timing tests
│   │   ├── test_subtitle_service.py    # SRT/VTT formatting and overlap checks
│   │   └── test_translation.py         # Heuristic & mock translation tests
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Root layout & Noto Sans Sinhala font
│   │   │   ├── page.tsx                # Studio landing page with interactive timeline preview
│   │   │   ├── upload/page.tsx         # Media upload & aspect ratio canvas selector
│   │   │   ├── projects/page.tsx       # Project management with aspect ratio badges
│   │   │   └── projects/[id]/page.tsx  # CapCut-style video editor workspace
│   │   ├── components/
│   │   │   ├── Navbar.tsx              # Global navigation bar & health indicator
│   │   │   └── editor/
│   │   │       ├── EditorNavbar.tsx    # Aspect ratio picker, undo/redo, autosave, export
│   │   │       ├── LeftSidebar.tsx     # Media library, AI subtitles, text presets, audio, effects
│   │   │       ├── PreviewPlayer.tsx   # Canvas preview, video sync, text & styled subtitle overlay
│   │   │       ├── PropertiesPanel.tsx # CapCut presets, clip speed/volume/scale, text styling
│   │   │       ├── TimelineEditor.tsx  # Multi-track timeline, playhead, split, trim, zoom
│   │   │       └── VideoExportModal.tsx# Render modal with 1080p/720p, SRT download, progress
│   │   └── lib/
│   │       ├── api.ts                  # Typed client for backend REST API
│   │       ├── types.ts                # TypeScript interfaces (Timeline, Tracks, Clips, Assets)
│   │       ├── presets.ts              # CapCut subtitle presets and title styles
│   │       └── utils.ts                # Time formatting and CSS helpers
│   ├── package.json
│   ├── tailwind.config.js
│   └── Dockerfile
├── storage/                            # Local storage for uploads, audio, exports & DB
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 🚀 Quick Start Guide

### Option 1: Running Locally (Development Mode)

#### 1. Backend Setup
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The FastAPI backend will start at `http://localhost:8000`. You can view the interactive OpenAPI documentation at `http://localhost:8000/docs`.

#### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the Next.js dev server
npm run dev
```
The Sinhala Studio editor will be live at `http://localhost:3000`.

---

### Option 2: Running with Docker Compose

Ensure Docker Desktop or Docker engine is running on your machine:
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`

---

## 🧪 Automated Test Suite

Run the full pytest suite inside the `backend` directory:
```bash
cd backend
python -m pytest tests -v
```
All 17 tests will run and verify:
- ✅ Health check API & provider discovery
- ✅ Project creation, metadata retrieval, and cue updating
- ✅ Media asset upload and thumbnail generation via FFmpeg
- ✅ CapCut-style ASS subtitle file generation with *Noto Sans Sinhala* font and color styling
- ✅ Real multi-track video rendering with burned-in Sinhala subtitles and audio mixing
- ✅ Full end-to-end ASR transcription, Sinhala translation, and export
- ✅ Timeline validation (overlaps, duration limits, line wrapping)
- ✅ Authentic Sinhala Unicode string formatting (`ආයුබෝවන්`, etc.)
- ✅ SRT and WebVTT cue formatting and line breaks
- ✅ Heuristic dictionary and mock translation providers

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Service health status and configured providers |
| `POST` | `/api/v1/projects` | Create a new video editing project (supports `aspect_ratio`) |
| `GET` | `/api/v1/projects` | List all existing projects with thumbnails and status |
| `GET` | `/api/v1/projects/{id}` | Get project details, cues, tracks, and timeline data |
| `POST` | `/api/v1/projects/{id}/upload` | Upload primary media file (MP4, MOV, MKV, MP3, etc.) |
| `POST` | `/api/v1/projects/{id}/assets` | Upload additional assets (B-roll video, overlay images, audio) |
| `GET` | `/api/v1/projects/{id}/assets` | List all media assets belonging to the project |
| `GET` | `/api/v1/projects/{id}/assets/{asset_id}/thumbnail` | Retrieve generated video thumbnail image |
| `PUT` | `/api/v1/projects/{id}/timeline` | Autosave timeline state (tracks, clips, trims, transforms) |
| `POST` | `/api/v1/projects/{id}/generate` | Launch AI speech transcription and Sinhala translation |
| `GET` | `/api/v1/jobs/{job_id}` | Poll pipeline progress and stage updates |
| `POST` | `/api/v1/projects/{id}/subtitles` | Add a new subtitle cue |
| `PATCH` | `/api/v1/projects/{id}/subtitles/{cue_id}` | Update text or timing of a cue |
| `DELETE` | `/api/v1/projects/{id}/subtitles/{cue_id}` | Delete a subtitle cue |
| `POST` | `/api/v1/projects/{id}/render` | Trigger FFmpeg multi-track video render job |
| `POST` | `/api/v1/projects/{id}/export` | Request standalone SRT, VTT, or TXT subtitle export |
| `GET` | `/api/v1/exports/{export_id}` | Check export job status |
| `GET` | `/api/v1/exports/{export_id}/download` | Download rendered MP4 video or subtitle file |
| `DELETE`| `/api/v1/projects/{id}` | Delete project and remove all associated media files |

---

## 📄 License
MIT License.
