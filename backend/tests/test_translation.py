import pytest
from app.services.translation_service import (
    RuleBasedHeuristicTranslationProvider,
    MockTranslationProvider,
    get_translation_provider
)

def test_heuristic_translation_unicode():
    provider = RuleBasedHeuristicTranslationProvider()
    res = provider.translate_text("hello")
    assert res == "ආයුබෝවන්"

    res_complex = provider.translate_text("welcome to our video presentation today")
    assert "සාදරයෙන් පිළිගනිමු" in res_complex

def test_mock_translation_provider():
    provider = get_translation_provider("mock")
    segments = [
        {"sequence_number": 1, "source_text": "Hello world", "start_time": 1000, "end_time": 3000}
    ]
    results = provider.translate_segments(segments)
    assert len(results) == 1
    assert "sinhala_text" in results[0]
    assert len(results[0]["sinhala_text"]) > 0


def test_singlish_phonetic_transliteration():
    from app.services.singlish_transliterator import transliterate_singlish_to_sinhala, has_sinhala_unicode
    
    assert has_sinhala_unicode("ආයුබෝවන්") is True
    assert has_sinhala_unicode("Hello world") is False
    
    res1 = transliterate_singlish_to_sinhala("Hari sewan")
    assert has_sinhala_unicode(res1) is True
    assert "හරි" in res1
    
    res2 = transliterate_singlish_to_sinhala("Sadhu sadhu")
    assert has_sinhala_unicode(res2) is True
    assert "සාදු" in res2

