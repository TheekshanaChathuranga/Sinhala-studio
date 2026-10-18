import re
from typing import Dict

# Independent vowels (ස්වර)
VOWELS: Dict[str, str] = {
    'aae': 'ඈ',
    'a\\': 'ඇ',
    'ae': 'ඇ',
    'aa': 'ආ',
    'ai': 'ඓ',
    'au': 'ඖ',
    'ou': 'ඖ',
    'ee': 'ඒ',
    'ea': 'ඒ',
    'ii': 'ඊ',
    'oo': 'ඕ',
    'oe': 'ඕ',
    'uu': 'ඌ',
    'a': 'අ',
    'e': 'එ',
    'i': 'ඉ',
    'o': 'ඔ',
    'u': 'උ',
}

# Vowel diacritics / signs (පිල්ලම්)
VOWEL_SIGNS: Dict[str, str] = {
    'aae': 'ෑ',
    'ae': 'ැ',
    'aa': 'ා',
    'ai': 'ෛ',
    'au': 'ෞ',
    'ou': 'ෞ',
    'ee': 'ේ',
    'ea': 'ේ',
    'ii': 'ී',
    'oo': 'ෝ',
    'oe': 'ෝ',
    'uu': 'ූ',
    'a': '',
    'e': 'ෙ',
    'i': 'ි',
    'o': 'ො',
    'u': 'ු',
}

# Multi-character consonants (මහාප්‍රාණ සහ සංයුක්ත)
SPECIAL_CONSONANTS: Dict[str, str] = {
    'sh': 'ශ',
    'ch': 'ච',
    'th': 'ත',
    'dh': 'ද',
    'kh': 'ඛ',
    'gh': 'ඝ',
    'ph': 'ඵ',
    'bh': 'භ',
    'jh': 'ඣ',
    'ny': 'ඤ',
    'nd': 'ඳ',
    'ng': 'ඟ',
    'mb': 'ඹ',
    'th\\': 'ඨ',
    'dh\\': 'ඪ',
}

# Single consonants (තනි ව්‍යංජන)
CONSONANTS: Dict[str, str] = {
    'k': 'ක',
    'g': 'ග',
    'c': 'ච',
    'j': 'ජ',
    't': 'ත',
    'd': 'ද',
    'n': 'න',
    'p': 'ප',
    'b': 'බ',
    'm': 'ම',
    'y': 'ය',
    'r': 'ර',
    'l': 'ල',
    'v': 'ව',
    'w': 'ව',
    's': 'ස',
    'h': 'හ',
    'f': 'ෆ',
    'z': 'ස',
    'x': 'ක්ස්',
    'q': 'ක්',
}

# Known Pali & Buddhist chant corrections for accurate phonetic representation
PALI_CHANT_MAP: Dict[str, str] = {
    "namatthu": "නමත්ථු",
    "buddhanam": "බුද්ධානං",
    "buddha": "බුද්ධ",
    "buddan": "බුද්දන්",
    "bodhiya": "බෝධියා",
    "vimuttanam": "විමුත්තානං",
    "vimuttiya": "විමුත්තියා",
    "parittam": "පරිත්තං",
    "paritan": "පරිත්තං",
    "katva": "කත්වා",
    "moro": "මෝරෝ",
    "esana": "ඒසනා",
    "brahmana": "බ්‍රාහ්මණා",
    "bratmana": "බ්‍රාහ්මණ",
    "sabbadhamme": "සබ්බධම්මේ",
    "sabbadan": "සබ්බධම්",
    "namo": "නමෝ",
    "palayantu": "පාලයන්තු",
    "udeti": "උදෙති",
    "harissavanno": "හරිස්සවණ්ණෝ",
    "pathavippabhaso": "පඨවිප්පභාසෝ",
    "cakkhuma": "චක්ඛුමා",
    "ekaraja": "ඒකරාජා",
    "piritha": "පිරිත",
    "pirith": "පිරිත්",
    "gatha": "ගාථා",
    "sadhu": "සාදු",
}


def has_sinhala_unicode(text: str) -> bool:
    """Checks if a string contains any Sinhala Unicode characters (U+0D80 to U+0DFF)."""
    return bool(re.search(r'[\u0D80-\u0DFF]', text))


def transliterate_singlish_to_sinhala(input_text: str) -> str:
    """
    Transliterates Romanized phonetic Sinhala / Singlish text into authentic Sinhala Unicode script.
    If the text already contains Sinhala characters, it preserves them cleanly.
    """
    if not input_text:
        return ""

    tokens = re.split(r'(\s+|[.,!?;:\'"()[\]{}]+)', input_text)
    result_tokens = []

    for token in tokens:
        if not token:
            continue
        # Preserve whitespace, punctuation, numbers, or already Sinhala text
        if re.match(r'^\s+$', token) or re.match(r'^[.,!?;:\'"()[\]{}]+$', token) or has_sinhala_unicode(token):
            result_tokens.append(token)
            continue

        lower_token = token.lower().strip()
        if lower_token in PALI_CHANT_MAP:
            result_tokens.append(PALI_CHANT_MAP[lower_token])
            continue

        res = []
        i = 0
        n = len(lower_token)

        while i < n:
            # Check special multi-char consonants
            cons = None
            matched_len = 0
            for key, val in SPECIAL_CONSONANTS.items():
                if lower_token.startswith(key, i):
                    cons = val
                    matched_len = len(key)
                    break

            # Check single char consonant
            if not cons:
                ch = lower_token[i]
                if ch in CONSONANTS:
                    cons = CONSONANTS[ch]
                    matched_len = 1

            if cons:
                i += matched_len

                # Check for Rakaranshaya (e.g. 'br', 'pr', 'tr', 'kr')
                if i < n and lower_token[i] == 'r' and (i + 1 < n and lower_token[i + 1] in 'aeiou'):
                    i += 1
                    # Followed by vowel sign
                    v_sign = None
                    v_len = 0
                    for vk, vv in sorted(VOWEL_SIGNS.items(), key=lambda x: len(x[0]), reverse=True):
                        if lower_token.startswith(vk, i):
                            v_sign = vv
                            v_len = len(vk)
                            break
                    res.append(cons + '්‍ර' + (v_sign if v_sign is not None else ''))
                    i += v_len
                    continue

                # Check for vowel signs
                v_sign = None
                v_len = 0
                for vk, vv in sorted(VOWEL_SIGNS.items(), key=lambda x: len(x[0]), reverse=True):
                    if lower_token.startswith(vk, i):
                        v_sign = vv
                        v_len = len(vk)
                        break

                if v_sign is not None:
                    res.append(cons + v_sign)
                    i += v_len
                else:
                    # Hal kireema (්)
                    res.append(cons + '්')
            else:
                # Standalone vowel
                v_ind = None
                v_len = 0
                for vk, vv in sorted(VOWELS.items(), key=lambda x: len(x[0]), reverse=True):
                    if lower_token.startswith(vk, i):
                        v_ind = vv
                        v_len = len(vk)
                        break

                if v_ind is not None:
                    res.append(v_ind)
                    i += v_len
                else:
                    # Non-letter (digit, symbol, etc.)
                    res.append(lower_token[i])
                    i += 1

        result_tokens.append(''.join(res))

    return ''.join(result_tokens)
