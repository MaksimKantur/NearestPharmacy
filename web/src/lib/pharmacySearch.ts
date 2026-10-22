import type { LatLng } from './geo';
import { findNearestPharmacies, type PharmacyWithDistance } from './overpass';
import { loadSnapshot, nearestInSnapshot } from './snapshot';

export type DataSource = { kind: 'live' } | { kind: 'snapshot'; generatedAt: string };

export interface SearchUpdate {
  pharmacies: PharmacyWithDistance[];
  source: DataSource;
  /** True while a live request is still running and may replace these results. */
  refreshing: boolean;
}

/** How long the live API gets before we show the offline snapshot instead. */
export const SNAPSHOT_FALLBACK_MS = 8_000;

type Settled<T> = { ok: true; value: T } | { ok: false; error: unknown };

const settle = <T>(promise: Promise<T>): Promise<Settled<T>> =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

const delay = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

/**
 * Live Overpass data first; the bundled snapshot if the API is slow or down.
 *
 * `onUpdate` fires once with the final result, or twice when the snapshot is
 * shown while the live request is still running and the live data arrives later.
 * Rejects only if neither source can answer for this location.
 */
export async function searchPharmacies(
  origin: LatLng,
  onUpdate: (update: SearchUpdate) => void,
  { signal, fallbackAfterMs = SNAPSHOT_FALLBACK_MS }: { signal?: AbortSignal; fallbackAfterMs?: number } = {},
): Promise<void> {
  const live = settle(findNearestPharmacies(origin, { signal }));
  const early = await Promise.race([live, delay(fallbackAfterMs)]);
  signal?.throwIfAborted();

  if (early?.ok) {
    onUpdate({ pharmacies: early.value, source: { kind: 'live' }, refreshing: false });
    return;
  }

  // Live is slow (early === null) or failed: try the snapshot.
  const snapshot = await settle(loadSnapshot());
  signal?.throwIfAborted();
  const fromSnapshot = snapshot.ok ? nearestInSnapshot(snapshot.value, origin) : [];
  const snapshotSource: DataSource | null = snapshot.ok
    ? { kind: 'snapshot', generatedAt: snapshot.value.generatedAt }
    : null;
  const liveStillRunning = early === null;

  if (fromSnapshot.length > 0 && snapshotSource) {
    onUpdate({ pharmacies: fromSnapshot, source: snapshotSource, refreshing: liveStillRunning });
  }

  const final = liveStillRunning ? await live : early;
  signal?.throwIfAborted();

  if (final.ok) {
    // An empty live answer next to snapshot hits most likely means a partial
    // outage rather than "no pharmacies", so we keep the snapshot results then.
    if (final.value.length > 0 || fromSnapshot.length === 0) {
      onUpdate({ pharmacies: final.value, source: { kind: 'live' }, refreshing: false });
    } else if (snapshotSource) {
      onUpdate({ pharmacies: fromSnapshot, source: snapshotSource, refreshing: false });
    }
    return;
  }

  if (fromSnapshot.length > 0 && snapshotSource) {
    if (liveStillRunning) {
      onUpdate({ pharmacies: fromSnapshot, source: snapshotSource, refreshing: false });
    }
    return;
  }
  throw final.error;
}
