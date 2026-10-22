import { useEffect, useState } from 'react';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { MapView } from './components/MapView';
import { PharmacyCard } from './components/PharmacyCard';
import { SearchControls } from './components/SearchControls';
import { usePharmacySearch, type Origin, type Status } from './hooks/usePharmacySearch';
import { useI18n } from './i18n/I18nProvider';
import type { MessageKey } from './i18n/translations';
import { formatDistance, isApproximate } from './lib/geo';

const PROGRESS_MESSAGE: Partial<Record<Status, MessageKey>> = {
  locating: 'locating',
  geocoding: 'geocoding',
  loading: 'loadingPharmacies',
};

function originDescription(origin: Origin, t: ReturnType<typeof useI18n>['t']): string {
  if (origin.source === 'gps') return t('originGps');
  if (origin.source === 'map') return t('originMap');
  return origin.label ?? '';
}

export default function App() {
  const { t, language } = useI18n();
  const search = usePharmacySearch(language);
  const { status, origin, pharmacies, source, refreshing, error } = search;
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // A new result set starts with the nearest pharmacy selected.
  useEffect(() => setSelectedId(pharmacies[0]?.id ?? null), [pharmacies]);

  const [nearest, ...others] = pharmacies;
  const progress = PROGRESS_MESSAGE[status];

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <img src="./favicon.svg" alt="" width={32} height={32} />
          <div>
            <h1>{t('appTitle')}</h1>
            <p className="header__tagline">{t('tagline')}</p>
          </div>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="layout">
        <section className="panel" aria-label={t('appTitle')}>
          <SearchControls onLocate={search.locate} onSearchAddress={search.searchAddress} />

          <div className="status" aria-live="polite">
            {progress && (
              <p className="status__progress">
                <span className="spinner" aria-hidden="true" />
                {t(progress)}
              </p>
            )}
            {error && (
              <div className="status__error" role="alert">
                <p>{t(error.key, error.vars)}</p>
                {error.key === 'errorNetwork' && (
                  <button type="button" className="btn btn--ghost" onClick={search.retry}>
                    {t('retry')}
                  </button>
                )}
              </div>
            )}
            {status === 'idle' && <p className="status__intro">{t('intro')}</p>}
          </div>

          {origin && status !== 'locating' && status !== 'geocoding' && (
            <p className="origin">
              <span className="origin__dot" aria-hidden="true" />
              {originDescription(origin, t)}
            </p>
          )}

          {origin?.source === 'gps' && isApproximate(origin.accuracy) && status !== 'locating' && (
            <p className="notice">
              {t('approximateLocation', { accuracy: formatDistance(origin.accuracy ?? 0, language) })}
            </p>
          )}

          {source?.kind === 'snapshot' && pharmacies.length > 0 && (
            <p className="notice">
              {refreshing && <span className="spinner" aria-hidden="true" />}
              {t(refreshing ? 'snapshotRefreshing' : 'snapshotNotice', {
                date: new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(
                  new Date(source.generatedAt),
                ),
              })}
            </p>
          )}

          {origin && nearest && (
            <div className="results">
              <h2 className="results__heading">{t('nearest')}</h2>
              <PharmacyCard
                pharmacy={nearest}
                origin={origin.location}
                variant="nearest"
                selected={selectedId === nearest.id}
                onSelect={setSelectedId}
              />

              {others.length > 0 && (
                <>
                  <h2 className="results__heading">{t('others')}</h2>
                  <ul className="results__list">
                    {others.map((p) => (
                      <li key={p.id}>
                        <PharmacyCard
                          pharmacy={p}
                          origin={origin.location}
                          variant="compact"
                          selected={selectedId === p.id}
                          onSelect={setSelectedId}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <footer className="panel__footer">{t('dataAttribution')}</footer>
        </section>

        <section className="map-wrap">
          <MapView
            origin={origin}
            pharmacies={pharmacies}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMapClick={search.searchFromPoint}
          />
        </section>
      </main>
    </div>
  );
}
