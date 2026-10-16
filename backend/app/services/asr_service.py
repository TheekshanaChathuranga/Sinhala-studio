import os
import time
import wave
import logging
import threading
import numpy as np
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# Global persistent cache for loaded Whisper models: key is (model_name, device, compute_type)
_MODEL_CACHE: Dict[Tuple[str, str, str], Any] = {}
_MODEL_LOCK = threading.Lock()

def load_wav_as_numpy(wav_path: str) -> np.ndarray:
    """
    Ultra-fast, zero-PyAV audio loader directly reading 16kHz 16-bit PCM WAV.
    Bypasses PyAV container parsing, avoids open(metadata_errors=...) bugs,
    and eliminates frame-by-frame garbage collection pauses.
    """
    with wave.open(wav_path, "rb") as wf:
        n_channels = wf.getnchannels()
        sampwidth = wf.getsampwidth()
        frames = wf.readframes(wf.getnframes())

        if sampwidth == 2:
            data = np.frombuffer(frames, dtype=np.int16).astype(np.float32) / 32768.0
        elif sampwidth == 4:
            data = np.frombuffer(frames, dtype=np.int32).astype(np.float32) / 2147483648.0
        else:
            data = np.frombuffer(frames, dtype=np.uint8).astype(np.float32) / 128.0 - 1.0

        if n_channels > 1:
            data = data.reshape(-1, n_channels).mean(axis=1)

        return data


class BaseASRService:
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        beam_size: int = 5,
        word_timestamps: bool = True
    ) -> Dict[str, Any]:
        raise NotImplementedError


class FasterWhisperASRService(BaseASRService):
    def __init__(self, model_name: str = "tiny", device: str = "cpu", compute_type: str = "int8"):
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type

    def _get_model(self):
        cache_key = (self.model_name, self.device, self.compute_type)
        if cache_key in _MODEL_CACHE:
            return _MODEL_CACHE[cache_key]

        with _MODEL_LOCK:
            if cache_key in _MODEL_CACHE:
                return _MODEL_CACHE[cache_key]

            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model '{self.model_name}' on {self.device} ({self.compute_type})...")
            
            try:
                model = WhisperModel(
                    self.model_name,
                    device=self.device,
                    compute_type=self.compute_type
                )
                _MODEL_CACHE[cache_key] = model
                logger.info(f"faster-whisper model '{self.model_name}' loaded successfully on {self.device}.")
                return model
            except Exception as e:
                # If CUDA runtime failed (e.g. cublas64_12.dll missing on Windows), gracefully fall back to CPU int8
                if self.device != "cpu":
                    logger.warning(f"Failed to load on {self.device} ({e}). Falling back to CPU int8...")
                    fallback_key = (self.model_name, "cpu", "int8")
                    if fallback_key in _MODEL_CACHE:
                        return _MODEL_CACHE[fallback_key]
                    
                    model = WhisperModel(
                        self.model_name,
                        device="cpu",
                        compute_type="int8"
                    )
                    _MODEL_CACHE[fallback_key] = model
                    self.device = "cpu"
                    self.compute_type = "int8"
                    logger.info(f"Fallback faster-whisper model '{self.model_name}' loaded on CPU int8.")
                    return model
                raise e

    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        beam_size: int = 5,
        word_timestamps: bool = True
    ) -> Dict[str, Any]:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        t_start_model = time.perf_counter()
        model = self._get_model()
        model_load_time_sec = round(time.perf_counter() - t_start_model, 4)

        # Handle "auto" language
        lang_arg = None if (language is None or language == "auto") else language

        # Fast direct PCM WAV loading to bypass PyAV container decoder bugs
        t_start_load = time.perf_counter()
        try:
            audio_data = load_wav_as_numpy(audio_path)
            audio_load_time_sec = round(time.perf_counter() - t_start_load, 4)
            audio_input = audio_data
        except Exception as e:
            logger.warning(f"Fast WAV loader failed ({e}); falling back to file path input.")
            audio_load_time_sec = 0.0
            audio_input = audio_path

        logger.info(f"Starting ASR transcription for {audio_path} (language={lang_arg}, beam_size={beam_size}, word_ts={word_timestamps})...")
        t_start_infer = time.perf_counter()
        
        segments_gen, info = model.transcribe(
            audio_input,
            language=lang_arg,
            task="transcribe",
            beam_size=beam_size,
            word_timestamps=word_timestamps,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        detected_lang = info.language
        lang_prob = info.language_probability
        duration = info.duration

        raw_segments = []
        for segment in segments_gen:
            words_list = []
            if segment.words:
                for w in segment.words:
                    words_list.append({
                        "word": w.word,
                        "start": round(w.start, 3),
                        "end": round(w.end, 3),
                        "probability": round(w.probability, 3)
                    })

            raw_segments.append({
                "start": round(segment.start, 3),
                "end": round(segment.end, 3),
                "text": segment.text.strip(),
                "words": words_list
            })

        inference_time_sec = round(time.perf_counter() - t_start_infer, 4)
        logger.info(f"ASR finished in {inference_time_sec}s. Detected: {detected_lang} ({lang_prob:.2f}), segments: {len(raw_segments)}")

        return {
            "detected_language": detected_lang,
            "language_probability": round(lang_prob, 3),
            "duration": round(duration, 2),
            "segments": raw_segments,
            "metrics": {
                "model_name": self.model_name,
                "device": self.device,
                "compute_type": self.compute_type,
                "model_load_time_sec": model_load_time_sec,
                "audio_load_time_sec": audio_load_time_sec,
                "inference_time_sec": inference_time_sec,
                "real_time_factor": round(inference_time_sec / max(duration, 0.001), 4)
            }
        }


class MockASRService(BaseASRService):
    """Deterministic mock ASR for unit testing and offline development."""
    def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None,
        beam_size: int = 5,
        word_timestamps: bool = True
    ) -> Dict[str, Any]:
        return {
            "detected_language": "en" if language in (None, "auto") else language,
            "language_probability": 0.98,
            "duration": 12.5,
            "segments": [
                {
                    "start": 0.5,
                    "end": 3.2,
                    "text": "Welcome to our video presentation today.",
                    "words": []
                },
                {
                    "start": 3.6,
                    "end": 7.0,
                    "text": "We will learn how to create accurate Sinhala subtitles.",
                    "words": []
                },
                {
                    "start": 7.5,
                    "end": 11.8,
                    "text": "Thank you for watching and supporting our project.",
                    "words": []
                }
            ],
            "metrics": {
                "model_name": "mock",
                "device": "cpu",
                "compute_type": "none",
                "model_load_time_sec": 0.0001,
                "audio_load_time_sec": 0.0001,
                "inference_time_sec": 0.005,
                "real_time_factor": 0.0004
            }
        }


def get_asr_service(
    provider: str = "faster_whisper",
    model_name: str = "tiny",
    device: str = "cpu",
    compute_type: str = "int8"
) -> BaseASRService:
    if provider == "mock":
        return MockASRService()
    return FasterWhisperASRService(model_name=model_name, device=device, compute_type=compute_type)
