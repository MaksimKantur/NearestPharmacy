/**
 * Downloads every pharmacy in the covered countries from OpenStreetMap and
 * writes the offline fallback dataset to public/data/pharmacies.json.
 *
 *   npm run snapshot
 *
 * The app only uses this file when the live Overpass API is slow or down.
 */
import { writeFile } from 'node:fs/promises';
import { PRIMARY_ENDPOINT, parseOverpass } from '../src/lib/overpass';
import { SNAPSHOT_LANGUAGES, type Snapshot } from '../src/lib/snapshot';

const COUNTRIES = ['FI', 'SE', 'EE'];
const OUT_FILE = new URL('../public/data/pharmacies.json', import.meta.url);

const query = `[out:json][timeout:300];
(${COUNTRIES.map((c) => `area["ISO3166-1"="${c}"][admin_level=2];`).join('')})->.countries;
(
  nwr["amenity"="pharmacy"](area.countries);
  nwr["healthcare"="pharmacy"](area.countries);
);
out center tags;`;

console.log(`Querying ${PRIMARY_ENDPOINT} for ${COUNTRIES.join(', ')}…`);
const res = await fetch(PRIMARY_ENDPOINT, {
  method: 'POST',
  body: new URLSearchParams({ data: query }),
  // overpass-api.de rejects anonymous tool user agents with 406.
  headers: { 'User-Agent': 'nearest-pharmacy-snapshot/1.0 (offline fallback dataset)' },
});
if (!res.ok) throw new Error(`Overpass responded ${res.status}: ${await res.text()}`);

const pharmacies = parseOverpass(await res.json()).map((p) => ({
  ...p,
  // Round to ~1 m and keep only names the UI can show, to keep the file small.
  location: { lat: +p.location.lat.toFixed(5), lng: +p.location.lng.toFixed(5) },
  localizedNames: Object.fromEntries(
    Object.entries(p.localizedNames).filter(([lang]) => SNAPSHOT_LANGUAGES.includes(lang)),
  ),
}));

const snapshot: Snapshot = {
  generatedAt: new Date().toISOString(),
  countries: COUNTRIES,
  pharmacies,
};
await writeFile(OUT_FILE, JSON.stringify(snapshot));
console.log(`Wrote ${pharmacies.length} pharmacies to ${OUT_FILE.pathname}`);
