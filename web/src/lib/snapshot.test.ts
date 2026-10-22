import { describe, expect, it } from 'vitest';
import { nearestInSnapshot, type Snapshot } from './snapshot';

const at = (id: number, lat: number, lng: number) => ({
  id: `node/${id}`,
  localizedNames: {},
  location: { lat, lng },
});

const snapshot: Snapshot = {
  generatedAt: '2026-10-01T00:00:00.000Z',
  countries: ['FI', 'SE', 'EE'],
  pharmacies: [
    at(1, 59.437, 24.7536), // Tallinn, ~80 km from Helsinki
    at(2, 60.2, 24.94), // ~3 km
    at(3, 60.171, 24.94), // ~150 m
  ],
};

describe('nearestInSnapshot', () => {
  it('returns pharmacies within 50 km, nearest first', () => {
    const result = nearestInSnapshot(snapshot, { lat: 60.1699, lng: 24.9384 });
    expect(result.map((p) => p.id)).toEqual(['node/3', 'node/2']);
  });

  it('returns nothing outside coverage', () => {
    expect(nearestInSnapshot(snapshot, { lat: 52.52, lng: 13.405 })).toEqual([]);
  });

  it('respects the limit', () => {
    expect(nearestInSnapshot(snapshot, { lat: 60.1699, lng: 24.9384 }, 1)).toHaveLength(1);
  });
});
