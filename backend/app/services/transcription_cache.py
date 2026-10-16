import os
import json
import hashlib
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List
from app.core.config import settings

logger = logging.getLogger(__name__)

CACHE_DIR = settings.STORAGE_DIR / "cache" / "transcriptions"
os.makedirs(CACHE_DIR, exist_ok=True)

# In-memory fast cache
_MEMORY_TRANSCRIPT_CACHE: Dict[str, Dict[str, Any]] = {}
_MEMORY_SEGMENTS_CACHE: Dict[str, List[Dict[str, Any]]] = {}

def compute_media_fingerprint(file_path: str) -> str:
    """
    Computes a deterministic, fast fingerprint for a media file based on
    file size, modification timestamp, and selective chunk hashing.
    Avoids loading multi-gigabyte media files into memory while remaining collision-resistant.
    """
    if not os.path.exists(file_path):
        return ""

    stat = os.stat(file_path)
    hasher = hashlib.sha256()
    hasher.update(f"{stat.st_size}-{stat.st_mtime}".encode("utf-8"))

    # Hash the first 64KB and last 64KB for content verification
    try:
        with open(file_path, "rb") as f:
            head = f.read(65536)
            hasher.update(head)
            if stat.st_size > 131072:
                f.seek(-65536, os.SEEK_END)
                tail = f.read(65536)
                hasher.update(tail)
    except Exception as e:
        logger.warning(f"Could not read media chunks for hashing: {e}")

    return hasher.hexdigest()[:24]


def _build_transcription_key(
    fingerprint: str,
    model_name: str,
    language: Optional[str],
    beam_size: int
) -> str:
    lang_str = language or "auto"
    return f"{fingerprint}_{model_name}_{lang_str}_b{beam_size}"


def get_cached_transcription(
    fingerprint: str,
    model_name: str,
    language: Optional[str],
    beam_size: int
) -> Optional[Dict[str, Any]]:
    """Retrieve cached speech recognition transcript if inputs are unchanged."""
    key = _build_transcription_key(fingerprint, model_name, language, beam_size)

    # 1. In-memory check
    if key in _MEMORY_TRANSCRIPT_CACHE:
        logger.info(f"Memory transcription cache HIT: {key}")
        return _MEMORY_TRANSCRIPT_CACHE[key]

    # 2. Disk persistence check
    disk_file = CACHE_DIR / f"{key}.json"
    if disk_file.exists():
        try:
            with open(disk_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                _MEMORY_TRANSCRIPT_CACHE[key] = data
                logger.info(f"Disk transcription cache HIT: {key}")
                return data
        except Exception as e:
            logger.warning(f"Error reading disk cache {disk_file}: {e}")

    return None


def set_cached_transcription(
    fingerprint: str,
    model_name: str,
    language: Optional[str],
    beam_size: int,
    data: Dict[str, Any]
) -> None:
    """Store transcript in memory and persist to disk cache."""
    key = _build_transcription_key(fingerprint, model_name, language, beam_size)
    _MEMORY_TRANSCRIPT_CACHE[key] = data

    disk_file = CACHE_DIR / f"{key}.json"
    try:
        with open(disk_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
    except Exception as e:
        logger.warning(f"Could not persist transcription cache to {disk_file}: {e}")


def get_cached_cues(
    transcription_key: str,
    max_chars_per_line: int,
    max_lines: int
) -> Optional[List[Dict[str, Any]]]:
    """Retrieve pre-segmented subtitle cues if formatting settings match."""
    cue_key = f"{transcription_key}_c{max_chars_per_line}_l{max_lines}"
    if cue_key in _MEMORY_SEGMENTS_CACHE:
        logger.info(f"Segmentation cache HIT: {cue_key}")
        return _MEMORY_SEGMENTS_CACHE[cue_key]
    return None


def set_cached_cues(
    transcription_key: str,
    max_chars_per_line: int,
    max_lines: int,
    cues: List[Dict[str, Any]]
) -> None:
    cue_key = f"{transcription_key}_c{max_chars_per_line}_l{max_lines}"
    _MEMORY_SEGMENTS_CACHE[cue_key] = cues
