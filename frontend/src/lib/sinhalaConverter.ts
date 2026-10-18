/**
 * Sinhala Unicode Converter & Diagnostic Utilities
 * Converts phonetic Romanized Sinhala (Singlish) into genuine Sinhala Unicode script.
 * Preserves existing Sinhala Unicode characters untouched.
 */

// Mapping tables for phonetic Singlish to Sinhala Unicode
const VOWELS: Record<string, string> = {
  'a': 'අ',
  'aa': 'ආ',
  'a\\': 'ඇ',
  'ae': 'ඇ',
  'aae': 'ඈ',
  'i': 'ඉ',
  'ii': 'ඊ',
  'ee': 'ඊ',
  'u': 'උ',
  'uu': 'ඌ',
  'oo': 'ඌ',
  'e': 'එ',
  'ea': 'ඒ',
  'ee\\': 'ඒ',
  'ai': 'ඓ',
  'o': 'ඔ',
  'oe': 'ඕ',
  'au': 'ඖ',
  'ou': 'ඖ',
};

const VOWEL_SIGNS: Record<string, string> = {
  'aa': 'ා',
  'a': '',
  'ae': 'ැ',
  'aae': 'ෑ',
  'i': 'ි',
  'ii': 'ී',
  'ee': 'ී',
  'u': 'ු',
  'uu': 'ූ',
  'oo': 'ූ',
  'e': 'ෙ',
  'ea': 'ේ',
  'ee\\': 'ේ',
  'ai': 'ෛ',
  'o': 'ො',
  'oe': 'ෝ',
  'au': 'ෞ',
  'ou': 'ෞ',
};

const SPECIAL_CONSONANTS: Record<string, string> = {
  'sh': 'ශ',
  'ch': 'ච',
  'th': 'ත',
  'dh': 'ද',
  'kh': 'ඛ',
  'gh': 'ඝ',
  'ph': 'ඵ',
  'bh': 'භ',
  'jh': 'ඣ',
  'th\\': 'ඨ',
  'dh\\': 'ඪ',
  'ny': 'ඤ',
  'nd': 'ඳ',
  'ng': 'ඟ',
  'mb': 'ඹ',
};

const CONSONANTS: Record<string, string> = {
  'k': 'ක',
  'g': 'ග',
  'c': 'ච',
  'j': 'ජ',
  't': 'ට',
  'd': 'ඩ',
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
};

const PALI_CHANT_MAP: Record<string, string> = {
  'namatthu': 'නමත්ථු',
  'buddhanam': 'බුද්ධානං',
  'buddha': 'බුද්ධ',
  'buddan': 'බුද්දන්',
  'bodhiya': 'බෝධියා',
  'vimuttanam': 'විමුත්තානං',
  'vimuttiya': 'විමුත්තියා',
  'parittam': 'පරිත්තං',
  'paritan': 'පරිත්තං',
  'katva': 'කත්වා',
  'moro': 'මෝරෝ',
  'esana': 'ඒසනා',
  'brahmana': 'බ්‍රාහ්මණා',
  'bratmana': 'බ්‍රාහ්මණ',
  'sabbadhamme': 'සබ්බධම්මේ',
  'sabbadan': 'සබ්බධම්',
  'namo': 'නමෝ',
  'palayantu': 'පාලයන්තු',
  'sadhu': 'සාදු',
};

/**
 * Checks if a string contains genuine Sinhala Unicode characters (range U+0D80 to U+0DFF).
 */
export function hasSinhalaUnicode(text: string): boolean {
  return /[\u0D80-\u0DFF]/.test(text);
}

/**
 * Returns detailed Unicode codepoint diagnostic string for logging and verification.
 */
export function analyzeUnicodeCodePoints(text: string): {
  char: string;
  codePoint: string;
  isSinhala: boolean;
}[] {
  return Array.from(text).map((char) => {
    const cp = char.codePointAt(0) || 0;
    return {
      char,
      codePoint: `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`,
      isSinhala: cp >= 0x0D80 && cp <= 0x0DFF,
    };
  });
}

/**
 * Transliterates Romanized phonetic Singlish text to Sinhala Unicode script.
 * If text already contains Sinhala characters, it passes them through safely.
 */
export function convertSinglishToSinhala(input: string): string {
  if (!input) return '';

  // Process word by word to preserve whitespace and punctuation
  const words = input.split(/(\s+|[.,!?;:'"()[\]{}])/);

  return words
    .map((token) => {
      // If it's whitespace or punctuation or already Sinhala, preserve as-is
      if (/^\s+$/.test(token) || /^[.,!?;:'"()[\]{}]+$/.test(token) || hasSinhalaUnicode(token)) {
        return token;
      }

      const lower = token.toLowerCase();
      if (PALI_CHANT_MAP[lower]) {
        return PALI_CHANT_MAP[lower];
      }

      let res = '';
      let i = 0;

      while (i < lower.length) {
        // Check for special consonants of length 3 or 2
        let cons = '';
        let matchedConsLen = 0;

        for (const [key, val] of Object.entries(SPECIAL_CONSONANTS)) {
          if (lower.startsWith(key, i)) {
            cons = val;
            matchedConsLen = key.length;
            break;
          }
        }

        if (!cons) {
          const singleChar = lower[i];
          if (CONSONANTS[singleChar]) {
            cons = CONSONANTS[singleChar];
            matchedConsLen = 1;
          }
        }

        if (cons) {
          i += matchedConsLen;

          // Check if followed by special conjunct (e.g. 'r' for 'ශ්‍රී' or 'ත්‍රි')
          if (i < lower.length && lower[i] === 'r' && i + 1 < lower.length && /[aeiou]/.test(lower[i + 1])) {
            // Rakaranshaya (්‍ර)
            i += 1;
            // Check vowel
            let vs = '';
            let vLen = 0;
            for (const [vk, vv] of Object.entries(VOWEL_SIGNS)) {
              if (lower.startsWith(vk, i)) {
                if (vk.length > vLen) {
                  vs = vv;
                  vLen = vk.length;
                }
              }
            }
            res += cons + '්‍ර' + (vLen > 0 ? vs : '');
            i += vLen;
            continue;
          }

          // Check for trailing vowel sign
          let matchedVowelSign = '';
          let matchedVowelLen = 0;

          // Prioritize longer vowel patterns like 'aae', 'aa', 'ee', 'oo'
          for (const [vk, vv] of Object.entries(VOWEL_SIGNS)) {
            if (lower.startsWith(vk, i)) {
              if (vk.length > matchedVowelLen) {
                matchedVowelSign = vv;
                matchedVowelLen = vk.length;
              }
            }
          }

          if (matchedVowelLen > 0) {
            res += cons + matchedVowelSign;
            i += matchedVowelLen;
          } else {
            // No vowel sign follows consonant -> Hal kireema (්) unless at end or followed by another consonant
            res += cons + '්';
          }
        } else {
          // Check for standalone vowel
          let matchedVowel = '';
          let matchedVowelLen = 0;

          for (const [vk, vv] of Object.entries(VOWELS)) {
            if (lower.startsWith(vk, i)) {
              if (vk.length > matchedVowelLen) {
                matchedVowel = vv;
                matchedVowelLen = vk.length;
              }
            }
          }

          if (matchedVowelLen > 0) {
            res += matchedVowel;
            i += matchedVowelLen;
          } else {
            // Non-alphabetic character
            res += token[i];
            i += 1;
          }
        }
      }

      return res;
    })
    .join('');
}
