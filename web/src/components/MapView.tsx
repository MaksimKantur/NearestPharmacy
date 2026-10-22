import { useEffect } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { latLng, latLngBounds } from 'leaflet';
import { isApproximate, type LatLng } from '../lib/geo';
import { displayName, type PharmacyWithDistance } from '../lib/overpass';
import type { Origin } from '../hooks/usePharmacySearch';
import { useI18n } from '../i18n/I18nProvider';

// Helsinki — shown until we know where the user is.
const DEFAULT_CENTER: LatLng = { lat: 60.1699, lng: 24.9384 };

interface MapViewProps {
  origin: Origin | null;
  pharmacies: PharmacyWithDistance[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMapClick: (location: LatLng) => void;
}

function ClickHandler({ onClick }: { onClick: (location: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Frames the origin and the nearest pharmacy whenever a new search finishes. */
function FitToResults({ origin, nearest }: { origin: Origin | null; nearest?: PharmacyWithDistance }) {
  const map = useMap();
  useEffect(() => {
    if (!origin) return;
    // With a rough position, "nearest" is a guess too: show the whole area the user may be in.
    if (isApproximate(origin.accuracy)) {
      map.fitBounds(latLng(origin.location).toBounds((origin.accuracy ?? 0) * 2), { padding: [20, 20] });
      return;
    }
    if (!nearest) {
      map.setView(origin.location, Math.max(map.getZoom(), 14));
      return;
    }
    const bounds = latLngBounds([origin.location, nearest.location]);
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 17 });
  }, [map, origin, nearest]);
  return null;
}

function PanToSelected({ selected }: { selected?: PharmacyWithDistance }) {
  const map = useMap();
  useEffect(() => {
    // Only move the map if the user picked something that isn't already in view.
    if (selected && !map.getBounds().contains(selected.location)) map.panTo(selected.location);
  }, [map, selected]);
  return null;
}

export function MapView({ origin, pharmacies, selectedId, onSelect, onMapClick }: MapViewProps) {
  const { t, language } = useI18n();
  const nearest = pharmacies[0];
  const selected = pharmacies.find((p) => p.id === selectedId);

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={12} className="map" zoomControl>
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <ClickHandler onClick={onMapClick} />
      <FitToResults origin={origin} nearest={nearest} />
      <PanToSelected selected={selected} />

      {/* Reverse so the nearest pharmacy is drawn last, on top of the others. */}
      {[...pharmacies].reverse().map((p) => {
        const isNearest = p.id === nearest?.id;
        const isSelected = p.id === selectedId;
        return (
          <CircleMarker
            key={p.id}
            center={p.location}
            radius={isNearest || isSelected ? 11 : 8}
            // Otherwise the click also reaches the map and moves the search origin.
            bubblingMouseEvents={false}
            pathOptions={{
              className: 'pharmacy-marker',
              color: '#ffffff',
              weight: 2,
              fillColor: isNearest ? '#0f766e' : isSelected ? '#0369a1' : '#64748b',
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              {displayName(p, language) ?? t('unnamedPharmacy')}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {origin?.accuracy !== undefined && (
        <Circle
          center={origin.location}
          radius={origin.accuracy}
          interactive={false}
          pathOptions={{ color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.08 }}
        />
      )}

      {origin && (
        <CircleMarker
          center={origin.location}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
          interactive={false}
        >
          <Tooltip permanent direction="bottom" offset={[0, 10]}>
            {origin.source === 'gps'
              ? t('youAreHere')
              : origin.source === 'address'
                ? origin.label?.split(',')[0]
                : t('originMap')}
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  );
}
