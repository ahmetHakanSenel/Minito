import i18n from './i18n/config';

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

// Checked in order, so broader categories (e.g. social's "meet") come after narrower ones.
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
    ],
  ],
];

/**
 * Categorizes a task input based on keywords
 */
export function categorizeTask(input: string): TaskCategory {
  const lowerInput = input.toLowerCase();
  const match = CATEGORY_KEYWORDS.find(([, keywords]) =>
    keywords.some((keyword) => lowerInput.includes(keyword))
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
export function getOfflineFallbackSteps(input: string): string[] {
  return getFallbackSteps(categorizeTask(input));
}
