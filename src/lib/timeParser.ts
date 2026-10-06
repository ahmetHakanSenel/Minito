/**
 * Time Parser Utility
 * Adım içeriğinden süre ifadelerini tespit eder
 */

interface ParsedTime {
  minutes: number;
  seconds: number;
}

/**
 * Adım metninden süre ifadesini tespit eder
 * Türkçe ve İngilizce destekler
 *
 * Örnekler:
 * - "30 saniye bekle" → { minutes: 0, seconds: 30 }
 * - "10 dk dinlen" → { minutes: 10, seconds: 0 }
 * - "5 minutes rest" → { minutes: 5, seconds: 0 }
 * - "2 min stretch" → { minutes: 2, seconds: 0 }
 */
/**
 * Turkish takes suffixes where English takes another word: a step says "10 dakikada", "20
 * dakikaya", "15 dakikalığına", "45 saniyede". Requiring a word boundary straight after the unit
 * matched none of them — six of ten natural phrasings — and the step then fell back to the
 * model's own estimate, so the timer silently counted a different number from the one written in
 * the instruction. Anything that follows the unit is allowed to be a suffix instead.
 *
 * English keeps its boundary, and the alternations run longest-first so `min` cannot swallow the
 * start of `minutes`.
 */
const TURKISH_SUFFIX = '[a-zçğıöşü]*';
const TURKISH_MINUTES = new RegExp(`(\\d+)\\s*(?:dakika|dk)${TURKISH_SUFFIX}`);
const TURKISH_SECONDS = new RegExp(`(\\d+)\\s*(?:saniye|sn)${TURKISH_SUFFIX}`);
const ENGLISH_MINUTES = /(\d+)\s*(?:minutes|minute|mins|min)\b/;
const ENGLISH_SECONDS = /(\d+)\s*(?:seconds|second|secs|sec)\b/;

export function parseTimeFromStep(step: string): ParsedTime | null {
  if (!step) return null;

  const text = step.toLowerCase();

  const minutePatterns = [TURKISH_MINUTES, ENGLISH_MINUTES];
  const secondPatterns = [TURKISH_SECONDS, ENGLISH_SECONDS];

  let minutes = 0;
  let seconds = 0;
  let found = false;

  // Dakika ara
  for (const pattern of minutePatterns) {
    const match = text.match(pattern);
    if (match) {
      minutes = parseInt(match[1], 10);
      found = true;
      break;
    }
  }

  // Saniye ara
  for (const pattern of secondPatterns) {
    const match = text.match(pattern);
    if (match) {
      seconds = parseInt(match[1], 10);
      found = true;
      break;
    }
  }

  if (!found || (minutes <= 0 && seconds <= 0)) {
    return null;
  }

  // Saniyeyi normalize et (60+ saniye → dakikaya çevir)
  if (seconds >= 60) {
    minutes += Math.floor(seconds / 60);
    seconds = seconds % 60;
  }

  return { minutes, seconds };
}

/**
 * User input'tan süre tespit eder (ana ekran için)
 * Daha geniş pattern desteği
 */
export function parseTimeFromInput(input: string): ParsedTime | null {
  if (!input) return null;

  const text = input.toLowerCase();

  // Same suffix problem as above; the home screen reads the same sentences.
  const match = text.match(TURKISH_MINUTES) ?? text.match(ENGLISH_MINUTES);

  if (!match) return null;

  const minutes = parseInt(match[1], 10);
  if (Number.isNaN(minutes) || minutes <= 0) return null;

  return { minutes, seconds: 0 };
}
