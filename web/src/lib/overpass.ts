import { distanceMeters, type LatLng } from './geo';

export interface Pharmacy {
  /** OSM element id, e.g. "node/123" — stable and unique across element types. */
  id: string;
  name?: string;
  /** Language-specific names from `name:<lang>` tags, e.g. { sv: 'Rödbergens apotek' }. */
  localizedNames: Record<string, string>;
  location: LatLng;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
}

export interface PharmacyWithDistance extends Pharmacy {
  distance: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/** The main public Overpass instance; fast, but occasionally returns 502/504 under load. */
export const PRIMARY_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** Community mirrors, raced in parallel only when the primary fails. */
export const MIRROR_ENDPOINTS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

// Generous: under load overpass-api.de answers in ~30 s, and a slow answer
// beats re-sending the query elsewhere. The UI shows the snapshot meanwhile.
const PRIMARY_TIMEOUT_MS = 30_000;
const MIRROR_TIMEOUT_MS = 30_000;

/**
 * Search radii in metres. We stop at the first radius that returns anything:
 * `around` is a true distance filter, so the closest hit inside radius R is
 * also the closest overall. Small radii keep the common (urban) case fast.
 */
export const SEARCH_RADII = [2_000, 10_000, 50_000];

export function buildQuery(center: LatLng, radius: number): string {
  const around = `(around:${radius},${center.lat},${center.lng})`;
  return `[out:json][timeout:25];
(
  nwr["amenity"="pharmacy"]${around};
  nwr["healthcare"="pharmacy"]${around};
);
out center tags;`;
}

function formatAddress(tags: Record<string, string>): string | undefined {
  const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(' ');
  const city = [tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
  const full = [street, city].filter(Boolean).join(', ');
  return full || undefined;
}

export function parseOverpass(response: OverpassResponse): Pharmacy[] {
  const seen = new Set<string>();
  const pharmacies: Pharmacy[] = [];

  for (const el of response.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) continue;

    // An element matching both amenity= and healthcare= comes back once per union branch.
    const id = `${el.type}/${el.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const tags = el.tags ?? {};
    const localizedNames: Record<string, string> = {};
    for (const [key, value] of Object.entries(tags)) {
      const match = /^name:([a-z]{2,3})$/.exec(key);
      if (match && value) localizedNames[match[1]] = value;
    }

    pharmacies.push({
      id,
      name: tags.name || tags.brand || undefined,
      localizedNames,
      location: { lat, lng },
      address: formatAddress(tags),
      openingHours: tags.opening_hours,
      phone: tags.phone ?? tags['contact:phone'],
      website: tags.website ?? tags['contact:website'],
    });
  }
  return pharmacies;
}

export function sortByDistance(origin: LatLng, pharmacies: Pharmacy[]): PharmacyWithDistance[] {
  return pharmacies
    .map((p) => ({ ...p, distance: distanceMeters(origin, p.location) }))
    .sort((a, b) => a.distance - b.distance);
}

/** Name in the UI language if mapped (Helsinki has many `name:sv` tags), otherwise the default name. */
export function displayName(pharmacy: Pharmacy, language: string): string | undefined {
  return pharmacy.localizedNames[language] ?? pharmacy.name;
}

async function queryEndpoint(
  endpoint: string,
  query: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<Pharmacy[]> {
  const signals = [AbortSignal.timeout(timeoutMs)];
  if (signal) signals.push(signal);
  const res = await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.any(signals),
  });
  if (!res.ok) throw new Error(`Overpass ${endpoint} responded ${res.status}`);
  return parseOverpass((await res.json()) as OverpassResponse);
}

export async function fetchPharmacies(
  center: LatLng,
  radius: number,
  signal?: AbortSignal,
): Promise<Pharmacy[]> {
  const query = buildQuery(center, radius);
  try {
    return await queryEndpoint(PRIMARY_ENDPOINT, query, PRIMARY_TIMEOUT_MS, signal);
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // Primary failed: first mirror to answer wins, the rest are cancelled.
  const race = new AbortController();
  const raceSignal = signal ? AbortSignal.any([signal, race.signal]) : race.signal;
  try {
    return await Promise.any(
      MIRROR_ENDPOINTS.map((endpoint) => queryEndpoint(endpoint, query, MIRROR_TIMEOUT_MS, raceSignal)),
    );
  } catch (err) {
    if (signal?.aborted) throw signal.reason;
    throw err instanceof AggregateError ? new Error('All Overpass endpoints failed', { cause: err }) : err;
  } finally {
    race.abort();
  }
}

/** Pharmacies around `origin`, nearest first. Empty if nothing within the largest radius. */
export async function findNearestPharmacies(
  origin: LatLng,
  { signal, limit = 20 }: { signal?: AbortSignal; limit?: number } = {},
): Promise<PharmacyWithDistance[]> {
  for (const radius of SEARCH_RADII) {
    const found = await fetchPharmacies(origin, radius, signal);
    if (found.length > 0) return sortByDistance(origin, found).slice(0, limit);
  }
  return [];
}
