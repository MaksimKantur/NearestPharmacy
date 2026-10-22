import { useState, type FormEvent } from 'react';
import { useI18n } from '../i18n/I18nProvider';

interface SearchControlsProps {
  onLocate: () => void;
  onSearchAddress: (query: string) => void;
}

export function SearchControls({ onLocate, onSearchAddress }: SearchControlsProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearchAddress(query);
  };

  return (
    <div className="controls">
      <button type="button" className="btn btn--primary btn--block" onClick={onLocate}>
        <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
          <path
            fill="currentColor"
            d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 3h-2.07A7 7 0 0 0 13 5.07V3h-2v2.07A7 7 0 0 0 5.07 11H3v2h2.07A7 7 0 0 0 11 18.93V21h2v-2.07A7 7 0 0 0 18.93 13H21v-2Zm-9 6a5 5 0 1 1 0-10 5 5 0 0 1 0 10Z"
          />
        </svg>
        {t('useMyLocation')}
      </button>

      <form className="search" onSubmit={submit} role="search">
        <input
          type="search"
          className="search__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('addressPlaceholder')}
          aria-label={t('addressPlaceholder')}
          autoComplete="street-address"
        />
        <button type="submit" className="btn btn--ghost" disabled={!query.trim()}>
          {t('search')}
        </button>
      </form>

      <p className="controls__hint">{t('mapHint')}</p>
    </div>
  );
}
