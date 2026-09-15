import React, { useEffect, useState, ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { initI18n } from './config';
import i18n from './config';
import { I18nextProvider } from 'react-i18next';

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * I18n Provider Component
 * Initializes i18n and provides language context
 */
export function I18nProvider({ children }: I18nProviderProps) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      try {
        await initI18n();
        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize i18n:', error);
        setIsReady(true); // Continue anyway (fail-soft)
      }
    };

    initialize();
  }, []);

  // Show loading indicator until i18n is ready
  // Always provide I18nextProvider to prevent "NO_I18NEXT_INSTANCE" error
  if (!isReady) {
    return (
      <I18nextProvider i18n={i18n}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#121212',
          }}
        >
          <ActivityIndicator size="small" color="#8B5CF6" />
        </View>
      </I18nextProvider>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

/**
 * Hook to change language
 */
export function useChangeLanguage() {
  const changeLanguage = async (language: string) => {
    try {
      await i18n.changeLanguage(language);
      const { saveLanguagePreference } = await import('./config');
      await saveLanguagePreference(language as any);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  return { changeLanguage };
}
