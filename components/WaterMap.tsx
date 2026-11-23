'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProvinceValue, ProvincesData } from '../lib/data';
import type { Report } from '../lib/reports';

// Choropleth bins. Blues sit at or above the national figure (93.2%);
// ambers below it — the same visual language as the source chart, so the
// gap reads at a glance. The darkest amber is reserved for the provinces
// furthest behind.
export function colorFor(value: number): string {
  if (value >= 97) return '#0a4a66';
  if (value >= 93.2) return '#147a9e';
  if (value >= 90) return '#5ba8c2';
  if (value >= 85) return '#d9a441';
  if (value >= 75) return '#bf7f16';
  return '#7a4e08';
}

const INDONESIA_BOUNDS: L.LatLngBoundsExpression = [
  [-11.8, 94.0],
  [6.8, 142.0],
];

interface Props {
  geojson: GeoJSON.FeatureCollection | null;
  provinces: ProvincesData | null;
  selected: string | null;
  onSelect: (name: string | null) => void;
  reports: Report[];
  onReportClick?: (report: Report) => void;
}

export default function WaterMap({ geojson, provinces, selected, onSelect, reports }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const centersRef = useRef<Map<string, L.LatLng>>(new Map());
  const selectedRef = useRef<string | null>(selected);
  selectedRef.current = selected;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    const map = L.map(mapRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: false,
      minZoom: 4,
      maxZoom: 9,
      maxBounds: [
        [-20, 85],
        [15, 150],
      ],
      maxBoundsViscosity: 0.6,
    });
    map.fitBounds(INDONESIA_BOUNDS, { padding: [8, 8] });
    L.control.attribution({ prefix: false }).addAttribution('Boundaries: ARC Institute atlas').addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    leafletRef.current = map;
    return () => {
      map.remove();
      leafletRef.current = null;
    };
  }, []);

  // Draw / redraw the choropleth when data or selection changes.
  useEffect(() => {
    const map = leafletRef.current;
    if (!map || !geojson || !provinces) return;
    const byName = new Map<string, number>(provinces.provinces.map((p: ProvinceValue) => [p.name, p.value]));

    if (layerRef.current) {
      layerRef.current.remove();
    }
    centersRef.current = new Map();

    const layer = L.geoJSON(geojson, {
      style: (feature) => {
        const name = feature?.properties?.name as string;
        const v = byName.get(name);
        const isSelected = selectedRef.current === name;
        return {
          fillColor: v === undefined ? '#c9d6dc' : colorFor(v),
          fillOpacity: v === undefined ? 0.55 : 0.88,
          color: isSelected ? '#0a2e4d' : '#ffffff',
          weight: isSelected ? 3 : 1,
          opacity: 1,
        };
      },
      onEachFeature: (feature, lyr) => {
        const name = feature?.properties?.name as string;
        const v = byName.get(name);
        const label =
          v === undefined
            ? `${name} — no data loaded`
            : `${name} — ${v.toFixed(1)}% of households have improved drinking water (2025)`;
        lyr.bindTooltip(label, { sticky: true, direction: 'top' });
        lyr.on('mouseover', () => {
          (lyr as L.Path).setStyle({ weight: 2.5, color: '#0a2e4d', fillOpacity: 0.97 });
        });
        lyr.on('mouseout', () => {
          const isSelected = selectedRef.current === name;
          (lyr as L.Path).setStyle({
            weight: isSelected ? 3 : 1,
            color: isSelected ? '#0a2e4d' : '#ffffff',
            fillOpacity: v === undefined ? 0.55 : 0.88,
          });
        });
        lyr.on('click', () => {
          onSelectRef.current(name);
        });
        try {
          const b = (lyr as L.GeoJSON).getBounds?.();
          if (b && b.isValid()) centersRef.current.set(name, b.getCenter());
        } catch {
          /* bounds unavailable for this feature */
        }
      },
    });
    layer.addTo(map);
    layerRef.current = layer;
    // Test hook: expose the province name on each SVG path. The elements only
    // exist after the layer is added to the map, so this must run after addTo.
    layer.eachLayer((lyr) => {
      const feat = (lyr as unknown as { feature?: { properties?: { name?: string } } }).feature;
      const name = feat?.properties?.name;
      const el = (lyr as L.Path).getElement?.();
      if (name && el) el.setAttribute('data-province', name);
    });
  }, [geojson, provinces, selected]);

  // Community-report markers, one per report, near its province centre with a
  // small deterministic offset so reports in the same province don't stack.
  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;
    group.clearLayers();
    reports.forEach((r) => {
      const c = centersRef.current.get(r.province);
      if (!c) return;
      let h = 0;
      for (let i = 0; i < r.id.length; i++) h = (h * 31 + r.id.charCodeAt(i)) % 1000;
      const dLat = ((h % 17) - 8) * 0.09;
      const dLng = ((Math.floor(h / 17) % 17) - 8) * 0.09;
      const marker = L.circleMarker([c.lat + dLat, c.lng + dLng], {
        radius: 6,
        color: '#ffffff',
        weight: 2,
        fillColor: r.condition === 'good' ? '#1f8a70' : '#c98a1b',
        fillOpacity: 1,
      });
      marker.bindPopup(
        `<b>${escapeHtml(r.province)}</b> — ${escapeHtml(r.place)}<br>${escapeHtml(r.text)}<br><small>${new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}${r.is_example ? ' · example report' : ''}</small>`,
      );
      marker.addTo(group);
    });
  }, [reports, geojson, provinces, selected]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} aria-label="Map of drinking-water access by province" />;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
