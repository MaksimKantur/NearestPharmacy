import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  MIRROR_ENDPOINTS,
  PRIMARY_ENDPOINT,
  SEARCH_RADII,
  buildQuery,
  displayName,
  findNearestPharmacies,
  parseOverpass,
  sortByDistance,
} from './overpass';

const ORIGIN = { lat: 60.1699, lng: 24.9384 };

const node = (id: number, lat: number, lon: number, tags: Record<string, string> = {}) => ({
  type: 'node' as const,
  id,
  lat,
  lon,
  tags: { amenity: 'pharmacy', ...tags },
});

const jsonResponse = (elements: unknown[]) =>
  new Response(JSON.stringify({ elements }), { status: 200 });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('buildQuery', () => {
  it('searches both pharmacy tags around the point and asks for way/relation centres', () => {
    const q = buildQuery(ORIGIN, 1500);
    expect(q).toContain('nwr["amenity"="pharmacy"](around:1500,60.1699,24.9384)');
    expect(q).toContain('nwr["healthcare"="pharmacy"](around:1500,60.1699,24.9384)');
    expect(q).toContain('out center tags');
  });
});

describe('parseOverpass', () => {
  it('maps nodes and uses the centre point of ways', () => {
    const result = parseOverpass({
      elements: [
        node(1, 60.17, 24.94, {
          name: 'Punavuoren apteekki',
          'name:sv': 'Rödbergens apotek',
          'addr:street': 'Fredrikinkatu',
          'addr:housenumber': '23',
          'addr:postcode': '00120',
          'addr:city': 'Helsinki',
          opening_hours: 'Mo-Fr 08:00-19:00',
          'contact:phone': '+358 9 6803440',
        }),
        { type: 'way', id: 2, center: { lat: 60.18, lon: 24.95 }, tags: { brand: 'Yliopiston Apteekki' } },
      ],
    });

    expect(result).toEqual([
      {
        id: 'node/1',
        name: 'Punavuoren apteekki',
        localizedNames: { sv: 'Rödbergens apotek' },
        location: { lat: 60.17, lng: 24.94 },
        address: 'Fredrikinkatu 23, 00120 Helsinki',
        openingHours: 'Mo-Fr 08:00-19:00',
        phone: '+358 9 6803440',
        website: undefined,
      },
      {
        id: 'way/2',
        name: 'Yliopiston Apteekki',
        localizedNames: {},
        location: { lat: 60.18, lng: 24.95 },
        address: undefined,
        openingHours: undefined,
        phone: undefined,
        website: undefined,
      },
    ]);
  });

  it('skips elements without coordinates and de-duplicates elements matched by both tags', () => {
    const result = parseOverpass({
      elements: [
        node(1, 60.17, 24.94),
        node(1, 60.17, 24.94),
        { type: 'relation', id: 3, tags: { amenity: 'pharmacy' } },
      ],
    });
    expect(result.map((p) => p.id)).toEqual(['node/1']);
  });

  it('does not confuse node and way ids that share a number', () => {
    const result = parseOverpass({
      elements: [node(7, 60.17, 24.94), { type: 'way', id: 7, center: { lat: 60.2, lon: 24.9 } }],
    });
    expect(result.map((p) => p.id)).toEqual(['node/7', 'way/7']);
  });
});

describe('displayName', () => {
  const [pharmacy] = parseOverpass({
    elements: [node(1, 0, 0, { name: 'Punavuoren apteekki', 'name:sv': 'Rödbergens apotek' })],
  });

  it('prefers the name in the UI language', () => {
    expect(displayName(pharmacy, 'sv')).toBe('Rödbergens apotek');
  });

  it('falls back to the default name', () => {
    expect(displayName(pharmacy, 'en')).toBe('Punavuoren apteekki');
  });
});

describe('sortByDistance', () => {
  it('orders pharmacies nearest first and attaches the distance', () => {
    const pharmacies = parseOverpass({
      elements: [node(1, 60.2, 24.94), node(2, 60.1700, 24.9384), node(3, 60.18, 24.94)],
    });
    const sorted = sortByDistance(ORIGIN, pharmacies);
    expect(sorted.map((p) => p.id)).toEqual(['node/2', 'node/3', 'node/1']);
    expect(sorted[0].distance).toBeLessThan(20);
  });
});

describe('findNearestPharmacies', () => {
  it('widens the radius until something is found', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([node(1, 60.2, 24.94), node(2, 60.18, 24.94)]));
    vi.stubGlobal('fetch', fetchMock);

    const result = await findNearestPharmacies(ORIGIN);

    expect(result.map((p) => p.id)).toEqual(['node/2', 'node/1']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondQuery = new URLSearchParams(fetchMock.mock.calls[1][1].body).get('data');
    expect(secondQuery).toContain(`around:${SEARCH_RADII[1]},`);
  });

  it('returns an empty list when nothing is within the largest radius', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await expect(findNearestPharmacies(ORIGIN)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(SEARCH_RADII.length);
  });

  it('respects the result limit', async () => {
    const many = Array.from({ length: 30 }, (_, i) => node(i, 60.17 + i * 0.001, 24.94));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(many)));

    await expect(findNearestPharmacies(ORIGIN, { limit: 5 })).resolves.toHaveLength(5);
  });

  it('falls back to the mirrors when the primary endpoint fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === PRIMARY_ENDPOINT) return new Response('busy', { status: 504 });
      if (url === MIRROR_ENDPOINTS[2]) return jsonResponse([node(1, 60.17, 24.94)]);
      return new Response('down', { status: 502 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await findNearestPharmacies(ORIGIN);

    expect(result.map((p) => p.id)).toEqual(['node/1']);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([PRIMARY_ENDPOINT, ...MIRROR_ENDPOINTS]);
  });

  it('rejects when every endpoint fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 502 })));
    await expect(findNearestPharmacies(ORIGIN)).rejects.toThrow('All Overpass endpoints failed');
  });

  it('stops without trying mirrors when the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(findNearestPharmacies(ORIGIN, { signal: controller.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
