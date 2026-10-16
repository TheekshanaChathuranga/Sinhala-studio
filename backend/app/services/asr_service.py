import os
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class BaseASRService:
    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        raise NotImplementedError

class FasterWhisperASRService(BaseASRService):
    _model_instance = None
    _current_model_name = None

    def __init__(self, model_name: str = "tiny", device: str = "cpu", compute_type: str = "int8"):
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type

    def _get_model(self):
        if (
            FasterWhisperASRService._model_instance is None
            or FasterWhisperASRService._current_model_name != self.model_name
        ):
            from faster_whisper import WhisperModel
            logger.info(f"Loading faster-whisper model '{self.model_name}' on {self.device} ({self.compute_type})...")
            FasterWhisperASRService._model_instance = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type
            )
            FasterWhisperASRService._current_model_name = self.model_name
            logger.info("faster-whisper model loaded successfully.")
        return FasterWhisperASRService._model_instance

    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found: {audio_path}")

        model = self._get_model()

        # Handle "auto" language
        lang_arg = None if (language is None or language == "auto") else language

        logger.info(f"Starting ASR transcription for {audio_path} (language={lang_arg})...")
        segments_gen, info = model.transcribe(
            audio_path,
            language=lang_arg,
            task="transcribe",
            beam_size=5,
            word_timestamps=True,
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

        logger.info(f"ASR finished. Detected language: {detected_lang} ({lang_prob:.2f}), segments: {len(raw_segments)}")

        return {
            "detected_language": detected_lang,
            "language_probability": round(lang_prob, 3),
            "duration": round(duration, 2),
            "segments": raw_segments
        }


class MockASRService(BaseASRService):
    """Deterministic mock ASR for unit testing and offline development."""
    def transcribe(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
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
            ]
        }


def get_asr_service(provider: str = "faster_whisper", model_name: str = "tiny") -> BaseASRService:
    if provider == "mock":
        return MockASRService()
    return FasterWhisperASRService(model_name=model_name)
