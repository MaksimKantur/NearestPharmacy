import { LANGUAGES, LANGUAGE_NAMES } from '../i18n/translations';
import { useI18n } from '../i18n/I18nProvider';

export function LanguageSwitcher() {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className="lang" role="group" aria-label={t('language')}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          className="lang__option"
          aria-pressed={lang === language}
          title={LANGUAGE_NAMES[lang]}
          lang={lang}
          onClick={() => setLanguage(lang)}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
