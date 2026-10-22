import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceMeters, formatDistance } from './geo';

const HELSINKI = { lat: 60.1699, lng: 24.9384 };
const STOCKHOLM = { lat: 59.3293, lng: 18.0686 };

describe('distanceMeters', () => {
  it('is zero for the same point', () => {
    expect(distanceMeters(HELSINKI, HELSINKI)).toBe(0);
  });

  it('matches the known Helsinki–Stockholm great-circle distance (~396 km)', () => {
    expect(distanceMeters(HELSINKI, STOCKHOLM) / 1000).toBeCloseTo(396, 0);
  });

  it('is symmetric', () => {
    expect(distanceMeters(HELSINKI, STOCKHOLM)).toBeCloseTo(distanceMeters(STOCKHOLM, HELSINKI), 6);
  });

  it('handles short distances (one thousandth of a degree of latitude ≈ 111 m)', () => {
    const north = { lat: HELSINKI.lat + 0.001, lng: HELSINKI.lng };
    expect(distanceMeters(HELSINKI, north)).toBeCloseTo(111.2, 0);
  });
});

describe('formatDistance', () => {
  it('shows metres rounded to 10 below one kilometre', () => {
    expect(formatDistance(347, 'en')).toBe('350 m');
    expect(formatDistance(3, 'en')).toBe('10 m');
  });

  it('shows one decimal of kilometres up to 10 km, using the locale separator', () => {
    expect(formatDistance(1234, 'en')).toBe('1.2 km');
    expect(formatDistance(1234, 'fi')).toBe('1,2 km');
    expect(formatDistance(1234, 'sv')).toBe('1,2 km');
  });

  it('shows whole kilometres from 10 km', () => {
    expect(formatDistance(12_600, 'en')).toBe('13 km');
  });
});

describe('directionsUrl', () => {
  it('builds a walking-directions link between the two points', () => {
    const url = new URL(directionsUrl(HELSINKI, STOCKHOLM));
    expect(url.origin + url.pathname).toBe('https://www.google.com/maps/dir/');
    expect(url.searchParams.get('origin')).toBe('60.1699,24.9384');
    expect(url.searchParams.get('destination')).toBe('59.3293,18.0686');
    expect(url.searchParams.get('travelmode')).toBe('walking');
  });
});
