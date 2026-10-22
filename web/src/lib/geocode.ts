import type { LatLng } from './geo';

export interface GeocodeResult {
  location: LatLng;
  label: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

/**
 * Address search via OpenStreetMap Nominatim. Called only on explicit submit,
 * which keeps us well within the public instance's 1 request/second policy.
 */
export async function geocode(
  query: string,
  language: string,
  signal?: AbortSignal,
): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1' });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': language },
    signal,
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);

  const [first] = (await res.json()) as NominatimResult[];
  if (!first) return null;
  return {
    location: { lat: Number(first.lat), lng: Number(first.lon) },
    // display_name runs all the way to the country; the first parts are enough to recognise it.
    label: first.display_name.split(', ').slice(0, 3).join(', '),
  };
}
