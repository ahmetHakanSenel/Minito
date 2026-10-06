import i18n from './i18n/config';
import { normalizeSteps, type BreakdownStep } from './breakdownSteps';

/**
 * Offline Mode Logic - Fallback Content
 *
 * Provides static fallback steps for critical task categories when the API is unavailable,
 * so users can still get help offline or during an outage. Steps come from the locale files
 * in the user's language; keywords cover both supported input languages.
 */

export enum TaskCategory {
  CLEANING = 'cleaning',
  STUDY = 'study',
  WORK = 'work',
  HEALTH = 'health',
  SOCIAL = 'social',
  FINANCIAL = 'financial',
  GENERAL = 'general',
}

export interface FallbackSteps {
  category: TaskCategory;
  steps: string[];
}

// Checked in order, so broader categories come after narrower ones: social's `meet` after
// work's `meeting`, and work's `work` after health's `workout`, which would otherwise make
// every workout a work task.
const CATEGORY_KEYWORDS: [TaskCategory, string[]][] = [
  [
    TaskCategory.CLEANING,
    [
      'clean',
      'tidy',
      'organize',
      'declutter',
      'room',
      'house',
      'apartment',
      'temizl',
      'toparla',
      // `toplama`/`toplaya`, not `topla`, which also sits inside `toplantı` and turned a work
      // meeting into a tidying task.
      'toplama',
      'toplaya',
      'yıka',
      'düzenle',
      'çamaşır',
      'bulaşık',
      'süpür',
    ],
  ],
  [
    TaskCategory.STUDY,
    [
      'study',
      'learn',
      'exam',
      'homework',
      'assignment',
      'read',
      'course',
      'ders',
      'sınav',
      'ödev',
      'öğren',
      'kurs',
      'okul',
      'tez',
    ],
  ],
  [
    TaskCategory.HEALTH,
    [
      'exercise',
      'workout',
      'health',
      'fitness',
      'diet',
      'meditation',
      'spor',
      'egzersiz',
      'antrenman',
      'sağlık',
      'diyet',
      'meditasyon',
      'yürüyüş',
      'doktor',
      'randevu',
      'hastane',
    ],
  ],
  [
    TaskCategory.WORK,
    [
      'work',
      'project',
      'meeting',
      'deadline',
      'task',
      'report',
      'proje',
      'toplantı',
      'teslim',
      'rapor',
      'sunum',
    ],
  ],
  [
    TaskCategory.SOCIAL,
    [
      'friend',
      'social',
      'party',
      'event',
      'meet',
      'arkadaş',
      'sosyal',
      'parti',
      'etkinlik',
      'buluş',
      // `annem`, not `anne`: these are matched as substrings, and `anne` sits inside the
      // English words `planned`, `channel` and `scanned`.
      'annem',
    ],
  ],
  [
    TaskCategory.FINANCIAL,
    [
      'money',
      'budget',
      'save',
      'bill',
      'payment',
      'financial',
      'para',
      'bütçe',
      'birikim',
      'fatura',
      'ödeme',
      'vergi',
      'beyanname',
    ],
  ],
];

/**
 * Both readings of the text in lower case.
 *
 * JavaScript's default lower case turns `I` into `i`, which is right for English and wrong for
 * Turkish, where the pair is `I`/`ı`: "SINAV" became "sinav" and stopped matching `sınav`. The
 * Turkish locale gets that right and breaks English in the mirror image, turning `TIDY` into
 * `tıdy`. The keywords are a mixed list, so rather than pick a language before we know which one
 * the person is writing, both readings are searched.
 */
function lowerCaseReadings(input: string): string[] {
  const english = input.toLowerCase();
  const turkish = input.toLocaleLowerCase('tr');
  return english === turkish ? [english] : [english, turkish];
}

/**
 * Categorizes a task input based on keywords.
 *
 * Keywords are matched as substrings, not as words, because Turkish adds its grammar to the end
 * of a word: "toplamam", "toplayacağım" and "toplama" all have to be found by `topla`. That also
 * means a short keyword can hide inside an unrelated word, so they are chosen long enough not to.
 */
export function categorizeTask(input: string): TaskCategory {
  const readings = lowerCaseReadings(input);
  const match = CATEGORY_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => readings.some((reading) => reading.includes(keyword)))
  );
  return match ? match[0] : TaskCategory.GENERAL;
}

/**
 * Gets fallback steps for a given category, in the active language
 */
export function getFallbackSteps(category: TaskCategory): string[] {
  const steps = i18n.t(`offlineSteps.${category}`, { returnObjects: true });
  if (Array.isArray(steps)) {
    return steps.filter((step): step is string => typeof step === 'string');
  }
  // A missing category translation must never leave the user without steps.
  return category === TaskCategory.GENERAL ? [] : getFallbackSteps(TaskCategory.GENERAL);
}

/**
 * Gets fallback steps for a task input
 * This is used when the API is unavailable (offline mode)
 */
export function getOfflineFallbackSteps(input: string): BreakdownStep[] {
  return normalizeSteps(getFallbackSteps(categorizeTask(input)));
}
