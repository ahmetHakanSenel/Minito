import { supabase } from '../../data/supabase/client';
import i18n from './config';

/**
 * Load translations from database and merge with existing translations
 * This allows dynamic translation updates without app deployment
 */
export async function loadTranslationsFromDatabase(languageCode: string): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('translations')
      .select('key, value')
      .eq('language_code', languageCode)
      .eq('namespace', 'translation');

    if (error) {
      console.warn('Failed to load translations from database:', error);
      return; // Fail-soft: continue with JSON translations
    }

    if (!data || data.length === 0) {
      // No database translations found, use JSON files only
      return;
    }

    // Convert database translations to i18next format
    const dbTranslations: Record<string, string> = {};
    for (const row of data) {
      // Convert dot notation keys to nested object
      const keys = row.key.split('.');
      let current: any = dbTranslations;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      
      current[keys[keys.length - 1]] = row.value;
    }

    // Merge database translations with existing resources
    i18n.addResourceBundle(languageCode, 'translation', dbTranslations, true, true);
  } catch (error) {
    console.warn('Error loading translations from database:', error);
    // Fail-soft: continue with JSON translations
  }
}

/**
 * Initialize i18n with database translations
 * Call this after i18n.init() to load dynamic translations
 */
export async function initDatabaseTranslations(): Promise<void> {
  const currentLanguage = i18n.language || 'en';
  await loadTranslationsFromDatabase(currentLanguage);
  
  // Listen for language changes and reload translations
  i18n.on('languageChanged', async (language) => {
    await loadTranslationsFromDatabase(language);
  });
}















