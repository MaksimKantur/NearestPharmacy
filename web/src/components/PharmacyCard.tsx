import { useEffect, useRef } from 'react';
import type { LatLng } from '../lib/geo';
import { directionsUrl, formatDistance } from '../lib/geo';
import { displayName, type PharmacyWithDistance } from '../lib/overpass';
import { useI18n } from '../i18n/I18nProvider';

interface PharmacyCardProps {
  pharmacy: PharmacyWithDistance;
  origin: LatLng;
  variant: 'nearest' | 'compact';
  selected: boolean;
  onSelect: (id: string) => void;
}

export function PharmacyCard({ pharmacy, origin, variant, selected, onSelect }: PharmacyCardProps) {
  const { t, language } = useI18n();
  const distance = formatDistance(pharmacy.distance, language);
  const classes = ['card', `card--${variant}`, selected && 'card--selected'].filter(Boolean).join(' ');
  const ref = useRef<HTMLElement>(null);

  // Bring the card into view when it's picked on the map. The nearest card is
  // already at the top and gets selected on every new search, so skip it.
  useEffect(() => {
    if (selected && variant === 'compact') {
      ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selected, variant]);

  return (
    <article className={classes} ref={ref}>
      <button type="button" className="card__main" onClick={() => onSelect(pharmacy.id)}>
        <span className="card__name">{displayName(pharmacy, language) ?? t('unnamedPharmacy')}</span>
        <span className="card__distance">{t('away', { distance })}</span>
        {pharmacy.address && <span className="card__address">{pharmacy.address}</span>}
      </button>

      {variant === 'nearest' && pharmacy.openingHours && (
        <p className="card__hours">
          <span>{t('openingHours')}:</span> {pharmacy.openingHours}
        </p>
      )}

      <div className="card__actions">
        <a
          className={variant === 'nearest' ? 'btn btn--primary' : 'btn btn--ghost'}
          href={directionsUrl(origin, pharmacy.location)}
          target="_blank"
          rel="noreferrer"
        >
          {t('directions')}
        </a>
        {variant === 'nearest' && pharmacy.phone && (
          <a className="btn btn--ghost" href={`tel:${pharmacy.phone.replace(/\s+/g, '')}`}>
            {t('call')}
          </a>
        )}
        {variant === 'nearest' && pharmacy.website && (
          <a className="btn btn--ghost" href={pharmacy.website} target="_blank" rel="noreferrer">
            {t('website')}
          </a>
        )}
      </div>
    </article>
  );
}
