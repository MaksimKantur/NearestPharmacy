import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { detectLanguage, isLanguage, translate, type Language, type MessageKey } from './translations';

const STORAGE_KEY = 'nearest-pharmacy.language';

interface I18nValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(stored)) return stored;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies) — fall through to detection.
  }
  return detectLanguage(navigator.languages ?? [navigator.language]);
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, 'appTitle');
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisting the choice is acceptable.
    }
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (key, vars) => translate(language, key, vars) }),
    [language, setLanguage],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
