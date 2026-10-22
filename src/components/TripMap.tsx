import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import { BaseMap } from './BaseMap';
import { DAY_COLORS, altNames, MODE_LABEL, fmtTime, type Event, type LatLng, type Model } from '../lib/core';

interface Props {
  model: Model;
  events: Event[];
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  playhead: number | null;
  follow: boolean;
  /** パネルなどで地図が隠れている幅（px）。その分を避けて表示する */
  inset: Inset;
}

export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const useDarkMode = () => {
  const mq = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), []);
  const [dark, setDark] = useState(mq.matches);
  useEffect(() => {
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mq]);
  return dark;
};

// CSS変数をLeafletのSVG属性に渡すため、実際の色を解決する
const resolveColor = (cssVar: string) => {
  const name = cssVar.match(/var\((--[^)]+)\)/)?.[1];
  return name ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888' : cssVar;
};

export function TripMap({ model, events, selectedPlaceId, onSelectPlace, playhead, follow, inset }: Props) {
  const dark = useDarkMode();
  const dayIndex = (day: string) => model.days.indexOf(day);
  // dark切り替えでも色を解決し直す
  const dayColors = useMemo(() => DAY_COLORS.map(resolveColor), [dark]); // eslint-disable-line react-hooks/exhaustive-deps
  const surface = useMemo(() => resolveColor('var(--surface)'), [dark]); // eslint-disable-line react-hooks/exhaustive-deps

  // スコープ内の地点に通し番号を振る（同じ地点は最初の訪問の番号）
  const stops = useMemo(() => {
    const seen = new Map<string, { n: number; day: string; arrive: number; names: string[] }>();
    for (const e of events) {
      if (e.kind !== 'visit') continue;
      const id = e.visit.placeId;
      if (!seen.has(id)) seen.set(id, { n: seen.size + 1, day: e.day, arrive: e.start, names: [] });
      seen.get(id)!.names.push(`${fmtTime(e.start)}–${fmtTime(e.end)}`);
    }
    return [...seen.entries()].map(([id, s]) => ({ id, ...s, place: model.place(id) }));
  }, [events, model]);

  const moves = events.filter((e): e is Extract<Event, { kind: 'move' }> => e.kind === 'move');

  const bounds = useMemo(() => {
    const pts: LatLng[] = moves.filter((m) => m.move.mode !== 'flight').flatMap((m) => model.movePath(m.move));
    if (pts.length === 0) stops.forEach((s) => pts.push([s.place.lat, s.place.lng]));
    return pts.length ? L.latLngBounds(pts) : null;
  }, [moves, stops, model]);

  const playPos = playhead != null ? model.positionAt(playhead) : null;

  return (
    <MapContainer className="map" center={[37.56, 126.98]} zoom={12} zoomControl={false} scrollWheelZoom>
      <ZoomControl position="topright" />
      <BaseMap dark={dark} />
      {moves.map((m) => {
        const color = dayColors[dayIndex(m.day)] ?? '#888';
        const mode = m.move.mode;
        return [
          mode !== 'walk' && mode !== 'flight' && (
            <Polyline
              key={`${m.id}-casing`}
              positions={model.movePath(m.move)}
              interactive={false}
              pathOptions={{ color: surface, weight: 8, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
          ),
          <Polyline
            key={m.id}
            positions={model.movePath(m.move)}
            pathOptions={{
              color,
              weight: mode === 'walk' ? 3 : 4,
              opacity: mode === 'flight' ? 0.5 : 0.9,
              dashArray: mode === 'walk' ? '2 7' : mode === 'flight' ? '8 8' : undefined,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          >
            <Tooltip sticky>
              {MODE_LABEL[mode]}
              {m.move.line ? `・${m.move.line}` : ''} {fmtTime(m.start)}→{fmtTime(m.end)}（{model.moveKm(m.move).toFixed(1)}km）
            </Tooltip>
          </Polyline>,
        ];
      })}
      {stops.map((s) => (
        <Marker
          key={s.id}
          position={[s.place.lat, s.place.lng]}
          zIndexOffset={s.id === selectedPlaceId ? 1000 : 0}
          eventHandlers={{ click: () => onSelectPlace(s.id) }}
          icon={L.divIcon({
            className: '',
            html: `<div class="pin${s.id === selectedPlaceId ? ' is-selected' : ''}" style="--pin:${dayColors[dayIndex(s.day)]}">${s.n}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })}
        >
          <Tooltip direction="top" offset={[0, -14]}>
            <strong>{s.place.name}</strong>
            <br />
            {altNames(s.place)}
            <br />
            {s.names.join(' / ')}
          </Tooltip>
        </Marker>
      ))}
      {playPos && (
        <Marker
          position={playPos}
          interactive={false}
          zIndexOffset={2000}
          icon={L.divIcon({ className: '', html: '<div class="playhead"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })}
        />
      )}
      <MapController
        bounds={bounds}
        focus={selectedPlaceId ? model.place(selectedPlaceId) : null}
        follow={follow ? playPos : null}
        inset={inset}
      />
    </MapContainer>
  );
}

function MapController({
  bounds,
  focus,
  follow,
  inset,
}: {
  bounds: L.LatLngBounds | null;
  focus: { lat: number; lng: number } | null;
  follow: LatLng | null;
  inset: Inset;
}) {
  const map = useMap();
  const tl = L.point(inset.left + 32, inset.top + 32);
  const br = L.point(inset.right + 32, inset.bottom + 32);
  // 見えている範囲の中心に latlng が来るような地図の中心
  const centerFor = (latlng: L.LatLngExpression, zoom: number) =>
    map.unproject(map.project(latlng, zoom).subtract(L.point((inset.left - inset.right) / 2, (inset.top - inset.bottom) / 2)), zoom);

  // カードの大きさが変わったら（画面幅の変化など）タイルを敷き直す
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);

  const key = bounds?.toBBoxString();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, { paddingTopLeft: tl, paddingBottomRight: br, maxZoom: 15 });
  }, [key, inset.left, inset.bottom]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!focus) return;
    const zoom = Math.max(map.getZoom(), 15);
    map.flyTo(centerFor([focus.lat, focus.lng], zoom), zoom, { duration: 0.6 });
  }, [focus?.lat, focus?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (follow) map.panInside(follow, { paddingTopLeft: L.point(tl.x + 40, tl.y + 40), paddingBottomRight: L.point(br.x + 40, br.y + 40) });
  }, [follow?.[0], follow?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
