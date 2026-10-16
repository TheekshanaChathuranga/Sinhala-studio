FROM python:3.11-slim

# Install system dependencies including FFmpeg and Sinhala fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto-core \
    fonts-noto-extra \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency specifications
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Create storage directories
RUN mkdir -p /storage/uploads /storage/audio /storage/exports

ENV STORAGE_DIR=/storage
ENV DATABASE_URL=sqlite:////storage/subtitles.db
ENV ASR_PROVIDER=faster_whisper
ENV ASR_MODEL=tiny
ENV ASR_DEVICE=cpu
ENV ASR_COMPUTE_TYPE=int8
ENV TRANSLATION_PROVIDER=hybrid

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
