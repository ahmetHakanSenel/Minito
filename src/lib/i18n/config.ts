import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import en from './locales/en.json';
import tr from './locales/tr.json';

const LANGUAGE_STORAGE_KEY = 'minito_language';

// Supported languages
export const SUPPORTED_LANGUAGES = ['en', 'tr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

// Default language (fallback)
const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/**
 * Get saved language preference or detect from device
 */
async function getInitialLanguage(): Promise<SupportedLanguage> {
  try {
    // Try to get saved language preference
    const savedLanguage = await SecureStore.getItemAsync(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && SUPPORTED_LANGUAGES.includes(savedLanguage as SupportedLanguage)) {
      return savedLanguage as SupportedLanguage;
    }

    // Detect from device locale
    const deviceLocale = Localization.getLocales()[0]?.languageCode;
    if (deviceLocale && SUPPORTED_LANGUAGES.includes(deviceLocale as SupportedLanguage)) {
      return deviceLocale as SupportedLanguage;
    }

    // Fallback to default
    return DEFAULT_LANGUAGE;
  } catch (error) {
    console.warn('Failed to get language preference:', error);
    return DEFAULT_LANGUAGE;
  }
}

/**
 * Save language preference
 */
export async function saveLanguagePreference(language: SupportedLanguage): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_STORAGE_KEY, language);
  } catch (error) {
    console.warn('Failed to save language preference:', error);
  }
}

/**
 * Initialize i18n
 */
export async function initI18n(): Promise<void> {
  const initialLanguage = await getInitialLanguage();

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      tr: { translation: tr },
    },
    lng: initialLanguage,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for React Native
    },
  });

  // Load database translations (fail-soft: if it fails, continue with JSON)
  try {
    const { initDatabaseTranslations } = await import('./databaseLoader');
    await initDatabaseTranslations();
  } catch (error) {
    console.warn('Failed to initialize database translations:', error);
    // Continue with JSON translations only
  }
}

export default i18n;
