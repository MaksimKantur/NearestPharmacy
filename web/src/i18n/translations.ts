export const LANGUAGES = ['en', 'fi', 'sv'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fi: 'Suomi',
  sv: 'Svenska',
};

const en = {
  appTitle: 'Nearest Pharmacy',
  tagline: 'Find the closest pharmacy to you',
  language: 'Language',
  useMyLocation: 'Use my location',
  addressPlaceholder: 'Search an address or place',
  search: 'Search',
  mapHint: 'Tip: click anywhere on the map to search from that point.',
  intro: 'Allow location access, search an address or click the map to find the nearest pharmacy.',
  locating: 'Getting your location…',
  geocoding: 'Looking up the address…',
  loadingPharmacies: 'Finding pharmacies nearby…',
  originGps: 'Your location',
  originMap: 'Selected point on the map',
  youAreHere: 'You are here',
  nearest: 'Nearest pharmacy',
  others: 'Other pharmacies nearby',
  away: '{distance} away',
  unnamedPharmacy: 'Pharmacy',
  openingHours: 'Hours',
  directions: 'Directions',
  call: 'Call',
  website: 'Website',
  noPharmacies: 'No pharmacies found within 50 km of this point.',
  errorGeolocationDenied:
    'Location access was denied. Search an address or click the map instead.',
  errorGeolocationUnavailable:
    "Couldn't determine your location. Search an address or click the map instead.",
  errorAddressNotFound: 'No place found for “{query}”.',
  errorNetwork: "Couldn't reach the map data service. Please try again.",
  retry: 'Try again',
  snapshotNotice: 'Live data is unavailable — showing saved data from {date}.',
  snapshotRefreshing: 'Live data is slow — showing saved data from {date} while it loads…',
  dataAttribution: 'Pharmacy data © OpenStreetMap contributors',
};

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const fi: Messages = {
  appTitle: 'Lähin apteekki',
  tagline: 'Löydä sinua lähin apteekki',
  language: 'Kieli',
  useMyLocation: 'Käytä sijaintiani',
  addressPlaceholder: 'Hae osoitetta tai paikkaa',
  search: 'Hae',
  mapHint: 'Vinkki: napsauta mitä tahansa kohtaa kartalla hakeaksesi sieltä.',
  intro: 'Salli sijainnin käyttö, hae osoitetta tai napsauta karttaa löytääksesi lähimmän apteekin.',
  locating: 'Haetaan sijaintiasi…',
  geocoding: 'Haetaan osoitetta…',
  loadingPharmacies: 'Etsitään lähellä olevia apteekkeja…',
  originGps: 'Sijaintisi',
  originMap: 'Valittu kohta kartalla',
  youAreHere: 'Olet tässä',
  nearest: 'Lähin apteekki',
  others: 'Muut lähellä olevat apteekit',
  away: '{distance} päässä',
  unnamedPharmacy: 'Apteekki',
  openingHours: 'Aukioloajat',
  directions: 'Reittiohjeet',
  call: 'Soita',
  website: 'Verkkosivut',
  noPharmacies: 'Apteekkeja ei löytynyt 50 km:n säteeltä.',
  errorGeolocationDenied:
    'Sijainnin käyttö estettiin. Hae osoitetta tai napsauta karttaa.',
  errorGeolocationUnavailable:
    'Sijaintiasi ei voitu määrittää. Hae osoitetta tai napsauta karttaa.',
  errorAddressNotFound: 'Haulla ”{query}” ei löytynyt paikkaa.',
  errorNetwork: 'Karttapalveluun ei saatu yhteyttä. Yritä uudelleen.',
  retry: 'Yritä uudelleen',
  snapshotNotice: 'Reaaliaikaiset tiedot eivät ole saatavilla – näytetään tallennetut tiedot ajalta {date}.',
  snapshotRefreshing:
    'Reaaliaikaiset tiedot latautuvat hitaasti – näytetään sillä välin tallennetut tiedot ajalta {date}…',
  dataAttribution: 'Apteekkitiedot © OpenStreetMapin tekijät',
};

const sv: Messages = {
  appTitle: 'Närmaste apotek',
  tagline: 'Hitta apoteket närmast dig',
  language: 'Språk',
  useMyLocation: 'Använd min plats',
  addressPlaceholder: 'Sök en adress eller plats',
  search: 'Sök',
  mapHint: 'Tips: klicka var som helst på kartan för att söka från den punkten.',
  intro: 'Tillåt platsåtkomst, sök en adress eller klicka på kartan för att hitta närmaste apotek.',
  locating: 'Hämtar din position…',
  geocoding: 'Söker adressen…',
  loadingPharmacies: 'Söker apotek i närheten…',
  originGps: 'Din plats',
  originMap: 'Vald punkt på kartan',
  youAreHere: 'Du är här',
  nearest: 'Närmaste apotek',
  others: 'Andra apotek i närheten',
  away: '{distance} bort',
  unnamedPharmacy: 'Apotek',
  openingHours: 'Öppettider',
  directions: 'Vägbeskrivning',
  call: 'Ring',
  website: 'Webbplats',
  noPharmacies: 'Inga apotek hittades inom 50 km från den här punkten.',
  errorGeolocationDenied:
    'Åtkomst till platsen nekades. Sök en adress eller klicka på kartan i stället.',
  errorGeolocationUnavailable:
    'Kunde inte fastställa din plats. Sök en adress eller klicka på kartan i stället.',
  errorAddressNotFound: 'Ingen plats hittades för ”{query}”.',
  errorNetwork: 'Kunde inte nå karttjänsten. Försök igen.',
  retry: 'Försök igen',
  snapshotNotice: 'Livedata är inte tillgänglig – visar sparad data från {date}.',
  snapshotRefreshing: 'Livedata laddas långsamt – visar sparad data från {date} under tiden…',
  dataAttribution: 'Apoteksdata © OpenStreetMap-bidragsgivare',
};

export const MESSAGES: Record<Language, Messages> = { en, fi, sv };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** First supported language from the browser's preference list, matched on the primary subtag. */
export function detectLanguage(preferred: readonly string[]): Language {
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split('-')[0];
    if (isLanguage(primary)) return primary;
  }
  return 'en';
}

export function translate(
  language: Language,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  return MESSAGES[language][key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
