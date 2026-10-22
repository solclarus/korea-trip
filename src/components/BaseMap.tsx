import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { setWorkerUrl } from 'maplibre-gl';
import '@maplibre/maplibre-gl-leaflet';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre 6 の Web Worker を Vite にまとめさせ、その URL を渡す（ビルド後も動くように）
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { useMap } from 'react-leaflet';
import { buildMapStyle } from '@/lib/mapStyle';

setWorkerUrl(maplibreWorkerUrl);

// ベクタータイルの地図を Leaflet の背景として敷く。スタイルは lib/mapStyle.ts。
export function BaseMap({ dark }: { dark: boolean }) {
  const map = useMap();
  const layerRef = useRef<L.MaplibreGL | null>(null);

  useEffect(() => {
    const layer = L.maplibreGL({ style: buildMapStyle(dark) }).addTo(map);
    layerRef.current = layer;
    return () => {
      layer.remove();
      layerRef.current = null;
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    layerRef.current?.getMaplibreMap().setStyle(buildMapStyle(dark));
  }, [dark]);

  return null;
}
