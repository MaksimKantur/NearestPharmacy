import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchUpdate } from './pharmacySearch';
import type { Snapshot } from './snapshot';

const ORIGIN = { lat: 60.1699, lng: 24.9384 };
const GENERATED_AT = '2026-10-01T00:00:00.000Z';

const liveElements = [{ type: 'node', id: 1, lat: 60.17, lon: 24.94, tags: { name: 'Live' } }];
const snapshot: Snapshot = {
  generatedAt: GENERATED_AT,
  countries: ['FI'],
  pharmacies: [
    { id: 'node/2', name: 'Saved', localizedNames: {}, location: { lat: 60.171, lng: 24.94 } },
    // ~400 km away — outside the 50 km reach, must be ignored.
    { id: 'node/3', name: 'Stockholm', localizedNames: {}, location: { lat: 59.33, lng: 18.07 } },
  ],
};

type Live = () => Promise<Response>;

/** Routes fetch: Overpass calls go to `live`, the snapshot file is served from memory. */
function stubFetch(live: Live, snapshotResponse = () => new Response(JSON.stringify(snapshot))) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => (url.endsWith('data/pharmacies.json') ? snapshotResponse() : live())),
  );
}

const ok = () => new Response(JSON.stringify({ elements: liveElements }));
const failing = async () => new Response('down', { status: 502 });
const after = (ms: number, make: () => Response) => () =>
  new Promise<Response>((resolve) => setTimeout(() => resolve(make()), ms));

// The snapshot module caches its download, so load fresh modules per test.
let searchPharmacies: typeof import('./pharmacySearch').searchPharmacies;
beforeEach(async () => {
  vi.resetModules();
  ({ searchPharmacies } = await import('./pharmacySearch'));
});
afterEach(() => vi.unstubAllGlobals());

async function run(fallbackAfterMs = 30) {
  const updates: SearchUpdate[] = [];
  await searchPharmacies(ORIGIN, (u) => updates.push(u), { fallbackAfterMs });
  return updates.map((u) => ({
    names: u.pharmacies.map((p) => p.name),
    source: u.source.kind,
    refreshing: u.refreshing,
  }));
}

describe('searchPharmacies', () => {
  it('uses live data when it answers in time, without touching the snapshot', async () => {
    stubFetch(async () => ok());
    expect(await run()).toEqual([{ names: ['Live'], source: 'live', refreshing: false }]);
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('pharmacies.json'))).toBe(false);
  });

  it('shows the snapshot while live data is slow, then replaces it', async () => {
    stubFetch(after(80, ok));
    expect(await run()).toEqual([
      { names: ['Saved'], source: 'snapshot', refreshing: true },
      { names: ['Live'], source: 'live', refreshing: false },
    ]);
  });

  it('falls back to the snapshot when the live API fails', async () => {
    stubFetch(failing);
    expect(await run()).toEqual([{ names: ['Saved'], source: 'snapshot', refreshing: false }]);
  });

  it('marks the snapshot final when the slow live request eventually fails', async () => {
    stubFetch(after(80, () => new Response('down', { status: 502 })));
    expect(await run()).toEqual([
      { names: ['Saved'], source: 'snapshot', refreshing: true },
      { names: ['Saved'], source: 'snapshot', refreshing: false },
    ]);
  });

  it('rejects when live fails and the location is outside snapshot coverage', async () => {
    stubFetch(failing, () => new Response(JSON.stringify({ ...snapshot, pharmacies: [] })));
    await expect(run()).rejects.toThrow();
  });

  it('rejects when both live data and the snapshot file are unavailable', async () => {
    stubFetch(failing, () => new Response('missing', { status: 404 }));
    await expect(run()).rejects.toThrow();
  });

  it('rejects without emitting updates once aborted', async () => {
    stubFetch(after(80, ok));
    const controller = new AbortController();
    const updates: SearchUpdate[] = [];
    const pending = searchPharmacies(ORIGIN, (u) => updates.push(u), {
      signal: controller.signal,
      fallbackAfterMs: 1_000,
    });
    controller.abort();
    await expect(pending).rejects.toThrow();
    expect(updates).toEqual([]);
  });
});
