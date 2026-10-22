export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two points in metres (haversine formula). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "350 m" below one kilometre, "1.2 km" / "1,2 km" (locale-aware) above. */
export function formatDistance(meters: number, locale: string): string {
  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `${new Intl.NumberFormat(locale).format(rounded)} m`;
  }
  const km = meters / 1000;
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: km < 10 ? 1 : 0 });
  return `${fmt.format(km)} km`;
}

/** A Google Maps walking-directions link; opens the native app on phones, needs no API key. */
export function directionsUrl(from: LatLng, to: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
