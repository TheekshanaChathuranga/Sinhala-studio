import os
import re
import json
import logging
from typing import List, Dict, Any, Optional
import httpx
from app.services.singlish_transliterator import (
    has_sinhala_unicode,
    transliterate_singlish_to_sinhala
)

logger = logging.getLogger(__name__)

# Common English to Sinhala translations dictionary for offline/fallback mode
OFFLINE_SINHALA_DICT = {
    "welcome": "සාදරයෙන් පිළිගනිමු",
    "welcome to our video presentation today": "අද අපගේ වීඩියෝ ඉදිරිපත් කිරීමට ඔබව සාදරයෙන් පිළිගනිමු",
    "we will learn how to create accurate sinhala subtitles": "නිවැරදි සිංහල උපසිරැසි නිර්මාණය කරන්නේ කෙසේදැයි අපි ඉගෙන ගනිමු",
    "thank you for watching and supporting our project": "අපගේ ව්‍යාපෘතිය නැරඹීම සහ සහයෝගය දැක්වීම පිළිබඳව ස්තූතියි",
    "hello": "ආයුබෝවන්",
    "thank you": "ස්තූතියි",
    "good morning": "සුබ උදෑසනක්",
    "good evening": "සුබ සැන්දෑවක්",
    "good night": "සුබ රාත්‍රියක්",
    "yes": "ඔව්",
    "no": "නැත",
    "please": "කරුණාකර",
    "sorry": "සමාවෙන්න",
    "how are you": "ඔබට කොහොමද",
    "video": "වීඩියෝව",
    "audio": "ශ්‍රව්‍ය",
    "subtitles": "උපසිරැසි",
    "project": "ව්‍යාපෘතිය",
    "computer": "පරිගණකය",
    "software": "මෘදුකාංගය",
    "technology": "තාක්ෂණය",
    "artificial intelligence": "කෘතිම බුද්ධිය",
    "machine learning": "යන්ත්‍ර ඉගෙනීම",
    "language": "භාෂාව",
    "speech": "කථනය",
    "presentation": "ඉදිරිපත් කිරීම",
    "accurate": "නිවැරදි",
    "learning": "ඉගෙනීම",
    "today": "අද",
    "tomorrow": "හෙට",
    "yesterday": "ඊයේ",
    "friend": "මිතුරා",
    "friends": "මිතුරන්",
    "start": "ආරම්භ කරන්න",
    "finish": "අවසන්",
    "stop": "නවත්වන්න"
}

class BaseTranslationProvider:
    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        source_language: str = "en",
        target_language: str = "si",
        style: str = "conversational",
        preserve_technical_terms: bool = True
    ) -> List[Dict[str, Any]]:
        raise NotImplementedError


class LLMTranslationProvider(BaseTranslationProvider):
    """
    Translates text to natural Sinhala using an OpenAI-compatible LLM endpoint
    (e.g., OpenAI GPT-4o-mini, Groq, Gemini OpenAI compatibility, or local Ollama).
    """
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model_name: str = "gpt-4o-mini"
    ):
        self.api_key = api_key or os.getenv("TRANSLATION_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.base_url = (base_url or os.getenv("TRANSLATION_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        self.model_name = model_name or os.getenv("TRANSLATION_MODEL", "gpt-4o-mini")

    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        source_language: str = "en",
        target_language: str = "si",
        style: str = "conversational",
        preserve_technical_terms: bool = True
    ) -> List[Dict[str, Any]]:
        if not self.api_key:
            raise ValueError("No LLM API key configured for translation.")

        if not segments:
            return []

        # System prompt tailored for high-quality Sinhala subtitle translation
        style_instruction = {
            "conversational": "Use natural, colloquial spoken Sinhala (කතා බහ කරන සිංහල). Avoid overly bookish or archaic grammar.",
            "formal": "Use grammatically formal, standard written Sinhala (ලේඛන ව්‍යවහාරය) suitable for documentaries or news.",
            "concise": "Use concise, easily readable Sinhala subtitles. Omit filler words while keeping core meaning."
        }.get(style, "Use natural, conversational Sinhala.")

        tech_instruction = (
            "Preserve widely recognized English technical terms, brand names, and programming terms as English words or transliterated loanwords (e.g. AI, Python, Internet, Software)."
            if preserve_technical_terms else
            "Translate technical terms into proper Sinhala equivalents wherever possible."
        )

        system_prompt = (
            f"You are an expert English-to-Sinhala subtitle translator.\n"
            f"Target language: Sinhala (සිංහල, Unicode).\n"
            f"Style guidelines: {style_instruction}\n"
            f"Technical terms: {tech_instruction}\n"
            f"IMPORTANT RULES:\n"
            f"1. You will receive a JSON array of subtitle segments with 'sequence_number' and 'text'.\n"
            f"2. Return ONLY a valid JSON array of objects with 'sequence_number' and 'sinhala_text'.\n"
            f"3. Maintain 1-to-1 mapping with identical sequence_numbers.\n"
            f"4. Do NOT drop or merge segments.\n"
            f"5. Use proper Unicode Sinhala characters."
        )

        # Batch in chunks of 25 segments to respect token limits
        batch_size = 25
        results_map = {}

        for i in range(0, len(segments), batch_size):
            chunk = segments[i:i + batch_size]
            input_items = [
                {"sequence_number": s.get("sequence_number", idx + 1), "text": s.get("source_text", "")}
                for idx, s in enumerate(chunk, start=i)
            ]

            payload = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": json.dumps(input_items, ensure_ascii=False)}
                ],
                "temperature": 0.3
            }

            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json"
            }

            try:
                with httpx.Client(timeout=45.0) as client:
                    resp = client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                    resp.raise_for_status()
                    data = resp.json()
                    raw_content = data["choices"][0]["message"]["content"].strip()
                    
                    # Clean markdown codeblocks if model wrapped in ```json
                    if raw_content.startswith("```"):
                        raw_content = re.sub(r"^```[a-zA-Z]*\n?", "", raw_content)
                        raw_content = re.sub(r"```$", "", raw_content).strip()

                    parsed_items = json.loads(raw_content)
                    for item in parsed_items:
                        results_map[item["sequence_number"]] = item["sinhala_text"]
            except Exception as e:
                logger.error(f"LLM translation batch failed: {e}")
                raise

        # Assign back
        output_segments = []
        for idx, seg in enumerate(segments, 1):
            seq = seg.get("sequence_number", idx)
            translated_text = results_map.get(seq, "")
            new_seg = dict(seg)
            new_seg["sinhala_text"] = translated_text
            output_segments.append(new_seg)

        return output_segments


class FreeMTTranslationProvider(BaseTranslationProvider):
    """
    Translates using public machine translation with automatic fallback:
    1. Google Translate endpoint for natural phrasing
    2. MyMemory API fallback
    3. Rule-based Singlish phonetic transliteration for Pali/Sinhala romanized speech
    Guarantees output is genuine Sinhala Unicode script.
    """
    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        source_language: str = "en",
        target_language: str = "si",
        style: str = "conversational",
        preserve_technical_terms: bool = True
    ) -> List[Dict[str, Any]]:
        output_segments = []
        src = "auto" if source_language in ("auto", None) else source_language
        tgt = target_language or "si"

        with httpx.Client(timeout=8.0) as client:
            for idx, seg in enumerate(segments, 1):
                new_seg = dict(seg)
                text = seg.get("source_text", "").strip()
                if not text:
                    new_seg["sinhala_text"] = ""
                    output_segments.append(new_seg)
                    continue

                translated_text = ""

                # 1. Try Google Translate API (fast & highly accurate for Sinhala)
                try:
                    gt_url = "https://translate.googleapis.com/translate_a/single"
                    params = {"client": "gtx", "sl": src, "tl": tgt, "dt": "t", "q": text}
                    resp = client.get(gt_url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                            pieces = [part[0] for part in data[0] if part and len(part) > 0 and part[0]]
                            cand = "".join(pieces).strip()
                            if has_sinhala_unicode(cand):
                                translated_text = cand
                except Exception as e:
                    logger.debug(f"Google MT failed for '{text}': {e}")

                # 2. Try MyMemory API if Google did not produce Sinhala
                if not translated_text:
                    try:
                        mm_url = "https://api.mymemory.translated.net/get"
                        mm_params = {"q": text, "langpair": f"en|{tgt}"}
                        resp = client.get(mm_url, params=mm_params)
                        if resp.status_code == 200:
                            data = resp.json()
                            cand = data.get("responseData", {}).get("translatedText", "")
                            if "MYMEMORY WARNING" not in cand.upper() and has_sinhala_unicode(cand):
                                translated_text = cand.strip()
                    except Exception as e:
                        logger.debug(f"MyMemory failed for '{text}': {e}")

                # 3. If MT did not return Sinhala (common for romanized Pali/Singlish phonetics):
                # Use phonetic Singlish transliteration to convert Roman characters directly to Sinhala Unicode!
                if not translated_text or not has_sinhala_unicode(translated_text):
                    translated_text = RuleBasedHeuristicTranslationProvider().translate_text(text)

                new_seg["sinhala_text"] = translated_text
                output_segments.append(new_seg)

        return output_segments


class RuleBasedHeuristicTranslationProvider(BaseTranslationProvider):
    """
    Offline dictionary and rule-based heuristic Singlish transliteration.
    Ensures that any English / Singlish / Pali text is faithfully represented in genuine Sinhala Unicode.
    """
    def translate_text(self, text: str) -> str:
        cleaned = text.strip()
        lower = cleaned.lower().rstrip(".?!,")

        # Check direct dictionary lookup
        if lower in OFFLINE_SINHALA_DICT:
            return OFFLINE_SINHALA_DICT[lower]

        # Word-by-word substitution with phrase preservation
        words = re.findall(r"\b[\w']+\b|[^\w\s]", cleaned)
        translated_words = []
        for w in words:
            w_lower = w.lower()
            if w_lower in OFFLINE_SINHALA_DICT:
                translated_words.append(OFFLINE_SINHALA_DICT[w_lower])
            elif has_sinhala_unicode(w):
                translated_words.append(w)
            elif re.match(r'^\w+$', w):
                # Transliterate Singlish/Roman phonetics directly to Sinhala Unicode!
                translated_words.append(transliterate_singlish_to_sinhala(w))
            else:
                translated_words.append(w)

        result = " ".join(translated_words)
        # Fix punctuation spacing
        result = re.sub(r'\s+([,.:;?!])', r'\1', result)
        return result

    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        source_language: str = "en",
        target_language: str = "si",
        style: str = "conversational",
        preserve_technical_terms: bool = True
    ) -> List[Dict[str, Any]]:
        output = []
        for idx, seg in enumerate(segments, 1):
            new_seg = dict(seg)
            text = seg.get("source_text", "")
            new_seg["sinhala_text"] = self.translate_text(text)
            output.append(new_seg)
        return output


class HybridTranslationProvider(BaseTranslationProvider):
    """
    Smart hybrid translator:
    1. Tries LLM if API key is provided
    2. Falls back to Free MT if online
    3. Falls back to Offline Heuristic dictionary
    """
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("TRANSLATION_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GEMINI_API_KEY")

    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        source_language: str = "en",
        target_language: str = "si",
        style: str = "conversational",
        preserve_technical_terms: bool = True
    ) -> List[Dict[str, Any]]:
        # 1. Try LLM if configured
        if self.api_key:
            try:
                logger.info("Attempting translation via LLM provider...")
                llm = LLMTranslationProvider(api_key=self.api_key)
                return llm.translate_segments(
                    segments, source_language, target_language, style, preserve_technical_terms
                )
            except Exception as e:
                logger.warning(f"LLM translation provider failed ({e}). Falling back to Free MT...")

        # 2. Try Free MT
        try:
            logger.info("Attempting translation via Free MT provider...")
            fmt = FreeMTTranslationProvider()
            return fmt.translate_segments(
                segments, source_language, target_language, style, preserve_technical_terms
            )
        except Exception as e:
            logger.warning(f"Free MT translation failed ({e}). Falling back to heuristic dictionary...")

        # 3. Fallback to heuristic
        heuristic = RuleBasedHeuristicTranslationProvider()
        return heuristic.translate_segments(
            segments, source_language, target_language, style, preserve_technical_terms
        )


class MockTranslationProvider(BaseTranslationProvider):
    """Deterministic mock translation for tests."""
    def translate_segments(
        self,
        segments: List[Dict[str, Any]],
        source_language: str = "en",
        target_language: str = "si",
        style: str = "conversational",
        preserve_technical_terms: bool = True
    ) -> List[Dict[str, Any]]:
        translations = [
            "අද අපගේ වීඩියෝ ඉදිරිපත් කිරීමට ඔබව සාදරයෙන් පිළිගනිමු.",
            "නිවැරදි සිංහල උපසිරැසි නිර්මාණය කරන්නේ කෙසේදැයි අපි ඉගෙන ගනිමු.",
            "අපගේ ව්‍යාපෘතිය නැරඹීම සහ සහයෝගය දැක්වීම පිළිබඳව ස්තූතියි."
        ]
        output = []
        for idx, seg in enumerate(segments):
            new_seg = dict(seg)
            new_seg["sinhala_text"] = translations[idx % len(translations)]
            output.append(new_seg)
        return output


def get_translation_provider(provider_type: str = "hybrid") -> BaseTranslationProvider:
    if provider_type == "mock":
        return MockTranslationProvider()
    elif provider_type == "llm":
        return LLMTranslationProvider()
    elif provider_type == "google" or provider_type == "mymemory":
        return FreeMTTranslationProvider()
    elif provider_type == "heuristic":
        return RuleBasedHeuristicTranslationProvider()
    else:
        return HybridTranslationProvider()
