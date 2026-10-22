# Nearest Pharmacy

Two apps that find the pharmacy closest to the user:

| App | Path | Stack |
| --- | --- | --- |
| Web | [`web/`](web) | React 19, TypeScript, Vite, Leaflet |
| iOS | [`ios/`](ios) | SwiftUI, MapKit, iOS 17+ |

## Web app

**Live:** https://maksimkantur.github.io/NearestPharmacy/ (deployed from `main` by GitHub Actions)

### Run locally

Requires Node.js 22.12+.

```bash
cd web
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm test           # unit tests (Vitest)
npm run build      # type-check + production build into web/dist
npm run preview    # serve the production build
npm run snapshot   # regenerate the offline pharmacy dataset (see below)
```

Browsers only expose geolocation on `https://` or `localhost`. Opening the dev
server from another device by its LAN IP won't prompt for location, but address
search and clicking on the map still work there.

### What it does

- On load, asks for the user's location and shows the **nearest pharmacy** with
  its distance, address, opening hours, phone, website and a walking-directions
  link. Other pharmacies nearby are listed by distance.
- If location is denied or unavailable, the user can **search an address** or
  **click anywhere on the map** to search from that point.
- Map and list are linked: selecting a marker highlights its card, and the other way round.
- UI in **English, Finnish and Swedish**: picked from the browser language,
  switchable in the header, and the choice is remembered. Pharmacy names use
  OSM's `name:fi` / `name:sv` / `name:en` when they exist (e.g. *Punavuoren
  apteekki* ↔ *Rödbergens apotek*).
- Responsive (map above the list on phones), keyboard accessible, dark mode.

### Where the data comes from

Everything is [OpenStreetMap](https://www.openstreetmap.org/copyright), so no API keys are needed.

| Need | Source |
| --- | --- |
| Pharmacies (live) | [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API): `amenity=pharmacy` or `healthcare=pharmacy` |
| Pharmacies (fallback) | `web/public/data/pharmacies.json`, a snapshot of every pharmacy in Finland, Sweden and Estonia (~2,400) |
| Address search | [Nominatim](https://nominatim.org/) |
| Map tiles | OpenStreetMap standard tiles |
| Directions | Google Maps URL scheme (opens the native maps app on phones) |

**How the nearest pharmacy is found.** Overpass is queried with growing radii
(2 km → 10 km → 50 km), stopping at the first radius with results. `around` is
a true distance filter, so the closest result inside radius *R* is the closest
one overall. Results are then sorted by great-circle (haversine) distance.

**Why there is a snapshot.** The public Overpass instance is free but
unreliable: under load a query can take ~30 s or fail with 502/504. The app
handles this in three steps:

1. The live query goes to `overpass-api.de`. If that fails, a few community
   mirrors are raced and the first answer wins.
2. If no live answer arrives within 8 s, the nearest pharmacies from the
   bundled snapshot are shown, with a notice and the snapshot date. The live
   request keeps running and replaces them when it finishes.
3. Outside snapshot coverage (FI/SE/EE), the app waits for live data only.

The snapshot (~110 KB gzipped) loads lazily, only when it's needed.
Regenerate it with `npm run snapshot`.

### Code tour

```
web/src/
├── lib/
│   ├── geo.ts             distance (haversine), formatting, directions URL
│   ├── overpass.ts        Overpass query, parsing, endpoint fallback, radius search
│   ├── snapshot.ts        offline dataset loading and lookup
│   ├── pharmacySearch.ts  live vs. snapshot orchestration
│   └── geocode.ts         Nominatim address search
├── hooks/usePharmacySearch.ts   UI state machine: locate → geocode → search; cancels superseded requests
├── i18n/                  EN/FI/SV messages, language detection, React context
├── components/            MapView, PharmacyCard, SearchControls, LanguageSwitcher
└── App.tsx
```

All logic that doesn't touch the UI lives in `lib/` as plain functions and is
covered by unit tests (`*.test.ts`).

### Deployment

`.github/workflows/web.yml` runs the tests, builds the app, and deploys
`web/dist` to GitHub Pages on every push to `main`. To enable it once, go to
**Settings → Pages → Source: GitHub Actions**. The build uses relative asset
paths, so it also works on any static host (Cloudflare Pages, Netlify, …) with
root `web`, build command `npm run build` and output `dist`.

## iOS app

### Run

Requires Xcode 16 or newer (iOS 17+ deployment target). No signing team or
third-party dependencies needed for the simulator.

1. Open `ios/NearestPharmacy.xcodeproj`.
2. Pick any iPhone simulator and press **Run** (⌘R).
3. Allow location access. The simulator has no real position, so set one with
   **Features → Location → Custom Location…** (e.g. Helsinki: `60.1699`, `24.9384`).
   Then tap the location button in the toolbar.

Tests: **⌘U** in Xcode, or

```bash
cd ios
xcodebuild test -project NearestPharmacy.xcodeproj -scheme NearestPharmacy \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

### What it does

Same flow as the web app, built the native way:

- Asks for location on launch and shows the **nearest pharmacy**: distance,
  address, and buttons for walking directions (Apple Maps), calling and the website.
  The other pharmacies nearby are listed below by distance.
- If location is denied, there's a shortcut to Settings. You can also **search
  an address** (search bar) or **tap anywhere on the map**.
- Tapping a marker selects that pharmacy and scrolls the list to it. Selecting
  a card frames it on the map together with the search origin.
- Localized into **English, Finnish and Swedish** with String Catalogs (including
  the location-permission prompt). The language follows the system setting,
  as is usual on iOS.

### Where the data comes from

Apple Maps, through MapKit. `MKLocalPointsOfInterestRequest` with the
`.pharmacy` category is used for pharmacies and `MKLocalSearch` for address search.
It needs no API key and has native-quality coverage. The radius grows
500 m → 2 km → 10 km → 25 km and stops at the first step with results. Smaller
steps matter here because MapKit caps how many results it returns, so a small
radius keeps that list focused on what's actually closest. Anything MapKit
returns beyond the requested radius is dropped, so "nearest within R" stays
true, and results are sorted by geodesic distance.

### Code tour

```
ios/NearestPharmacy/
├── Models/Pharmacy.swift            Pharmacy, RankedPharmacy (pharmacy + distance)
├── Services/
│   ├── Services.swift               protocols: PharmacyProvider, LocationProviding, Geocoding
│   ├── MapKitPharmacyProvider.swift MapKit POI search
│   ├── MapKitGeocoder.swift         address / place search
│   └── LocationProvider.swift       CLLocationManager wrapped in async/await
├── ViewModels/PharmacyFinder.swift  @Observable state machine: locate → geocode → search;
│                                    every action cancels the previous one
├── Support/                         distance, formatting, directions URL, map framing
├── Views/                           ContentView, PharmacyMap, ResultsPanel, cards
└── Resources/                       Localizable / InfoPlist string catalogs
ios/NearestPharmacyTests/            Swift Testing: search logic (with fakes), geo, formatting
```

The services sit behind protocols, so `PharmacyFinder` is tested with fakes,
with no network or location access involved.

`.github/workflows/ios.yml` builds the app and runs the tests on a macOS runner
on every push.

