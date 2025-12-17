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
export function parseTimeFromStep(step: string): ParsedTime | null {
    if (!step) return null;

    const text = step.toLowerCase();

    // Dakika patterns (Türkçe + İngilizce)
    const minutePatterns = [
        /(\d+)\s*(dk|dakika|dakikalık)\b/,
        /(\d+)\s*(min|mins|minute|minutes)\b/,
    ];

    // Saniye patterns (Türkçe + İngilizce)
    const secondPatterns = [
        /(\d+)\s*(sn|saniye|saniyelik)\b/,
        /(\d+)\s*(sec|secs|second|seconds)\b/,
    ];

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

    // Dakika patterns - ana ekran için daha esnek
    const timeRegex = /(\d+)\s*(dk|dakika|min|mins|minute|minutes)\b/;
    const match = text.match(timeRegex);

    if (!match) return null;

    const minutes = parseInt(match[1], 10);
    if (Number.isNaN(minutes) || minutes <= 0) return null;

    return { minutes, seconds: 0 };
}
