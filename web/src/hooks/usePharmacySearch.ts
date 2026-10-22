import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng } from '../lib/geo';
import { geocode } from '../lib/geocode';
import type { PharmacyWithDistance } from '../lib/overpass';
import { searchPharmacies, type DataSource } from '../lib/pharmacySearch';
import type { MessageKey } from '../i18n/translations';

export type OriginSource = 'gps' | 'address' | 'map';

export interface Origin {
  location: LatLng;
  source: OriginSource;
  /** Human-readable place name, set for address searches. */
  label?: string;
}

export type Status = 'idle' | 'locating' | 'geocoding' | 'loading' | 'done' | 'error';

export interface SearchError {
  key: MessageKey;
  vars?: Record<string, string>;
}

export interface PharmacySearch {
  status: Status;
  origin: Origin | null;
  pharmacies: PharmacyWithDistance[];
  /** Where the current results came from; null until there are results. */
  source: DataSource | null;
  /** Snapshot results are shown and live data may still replace them. */
  refreshing: boolean;
  error: SearchError | null;
  locate: () => void;
  searchAddress: (query: string) => void;
  searchFromPoint: (location: LatLng) => void;
  retry: () => void;
}

/**
 * Owns the "where is the user → which pharmacies are closest" flow.
 * Every new action supersedes the previous one: in-flight HTTP requests are
 * aborted and late geolocation callbacks are ignored.
 */
export function usePharmacySearch(language: string): PharmacySearch {
  const [status, setStatus] = useState<Status>('idle');
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [pharmacies, setPharmacies] = useState<PharmacyWithDistance[]>([]);
  const [source, setSource] = useState<DataSource | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<SearchError | null>(null);

  const controllerRef = useRef<AbortController | null>(null);
  const lastActionRef = useRef<() => void>(() => {});

  /** Cancels whatever is running and returns a signal for the new action. */
  const begin = useCallback((next: Status) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setStatus(next);
    setError(null);
    return controller.signal;
  }, []);

  const fail = useCallback((err: SearchError) => {
    setError(err);
    setStatus('error');
  }, []);

  const searchFrom = useCallback(
    async (next: Origin, signal: AbortSignal) => {
      setOrigin(next);
      setPharmacies([]);
      setSource(null);
      setRefreshing(false);
      setStatus('loading');
      try {
        await searchPharmacies(
          next.location,
          (update) => {
            if (signal.aborted) return;
            setPharmacies(update.pharmacies);
            setSource(update.source);
            setRefreshing(update.refreshing);
            if (update.pharmacies.length === 0) fail({ key: 'noPharmacies' });
            else setStatus('done');
          },
          { signal },
        );
      } catch {
        if (!signal.aborted) fail({ key: 'errorNetwork' });
      }
    },
    [fail],
  );

  const searchFromPoint = useCallback(
    (location: LatLng) => {
      const signal = begin('loading');
      lastActionRef.current = () => searchFromPoint(location);
      void searchFrom({ location, source: 'map' }, signal);
    },
    [begin, searchFrom],
  );

  const locate = useCallback(() => {
    lastActionRef.current = locate;
    if (!('geolocation' in navigator)) {
      begin('locating');
      fail({ key: 'errorGeolocationUnavailable' });
      return;
    }
    const signal = begin('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (signal.aborted) return;
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        void searchFrom({ location, source: 'gps' }, signal);
      },
      (err) => {
        if (signal.aborted) return;
        fail({
          key:
            err.code === err.PERMISSION_DENIED
              ? 'errorGeolocationDenied'
              : 'errorGeolocationUnavailable',
        });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  }, [begin, fail, searchFrom]);

  const searchAddress = useCallback(
    (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      lastActionRef.current = () => searchAddress(trimmed);
      const signal = begin('geocoding');
      geocode(trimmed, language, signal)
        .then((result) => {
          if (signal.aborted) return;
          if (!result) {
            fail({ key: 'errorAddressNotFound', vars: { query: trimmed } });
            return;
          }
          void searchFrom({ location: result.location, source: 'address', label: result.label }, signal);
        })
        .catch(() => {
          if (!signal.aborted) fail({ key: 'errorNetwork' });
        });
    },
    [begin, fail, language, searchFrom],
  );

  const retry = useCallback(() => lastActionRef.current(), []);

  // Locate on first load — finding the nearest pharmacy is the whole point of the page.
  useEffect(() => {
    locate();
    return () => controllerRef.current?.abort();
  }, [locate]);

  return { status, origin, pharmacies, source, refreshing, error, locate, searchAddress, searchFromPoint, retry };
}
