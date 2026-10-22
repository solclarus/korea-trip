import type {
  ExpressionSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';

// Apple Maps 風の自前スタイル。タイルは OpenFreeMap（OpenMapTiles スキーマ、APIキー不要）。
// 和文・ハングルの字形はブラウザのシステムフォントで描かれる（MapLibre の localIdeographFontFamily）。

const palette = {
  light: {
    land: '#f6f3ee',
    urban: '#f0ece5',
    park: '#cde8bd',
    wood: '#bfe0ab',
    water: '#9ccff2',
    waterText: '#3d7fb6',
    sand: '#f3ead2',
    airport: '#e9e5f0',
    hospital: '#f8e3e3',
    school: '#f3ecdb',
    building: '#e8e3db',
    buildingLine: '#dcd6cc',
    road: '#ffffff',
    roadCase: '#e2dcd2',
    major: '#ffffff',
    majorCase: '#d5cdc0',
    motorway: '#fcd67e',
    motorwayCase: '#e8b552',
    rail: '#c8c2b8',
    boundary: '#b9b2c4',
    text: '#3f3f44',
    textStrong: '#1f1f23',
    textMuted: '#808086',
    halo: '#ffffff',
    parkText: '#4b8a3a',
    station: '#4f7fe0',
  },
  dark: {
    land: '#34363b',
    urban: '#383b40',
    park: '#344a3a',
    wood: '#2f4535',
    water: '#27486a',
    waterText: '#8fbfe8',
    sand: '#45423a',
    airport: '#3d3c46',
    hospital: '#4a3a3d',
    school: '#433f37',
    building: '#42454b',
    buildingLine: '#4b4e55',
    road: '#50535a',
    roadCase: '#3b3e44',
    major: '#5e6168',
    majorCase: '#44474d',
    motorway: '#9a8250',
    motorwayCase: '#6f5d38',
    rail: '#5a5d63',
    boundary: '#6f6a7c',
    text: '#d8d8dc',
    textStrong: '#f2f2f5',
    textMuted: '#9a9aa0',
    halo: '#2b2d31',
    parkText: '#9fcf8c',
    station: '#7ea4f0',
  },
};

// POI の色分け（Apple Maps のカテゴリ色に寄せる）
const poiColor = (dark: boolean): ExpressionSpecification => [
  'match',
  ['get', 'class'],
  ['restaurant', 'fast_food', 'food_court', 'bar', 'pub', 'beer'],
  dark ? '#f0a35a' : '#f08a24',
  ['cafe', 'bakery', 'ice_cream'],
  dark ? '#d9a77c' : '#b7773f',
  ['shop', 'clothing_store', 'grocery', 'department_store', 'gift', 'cosmetics', 'mall'],
  dark ? '#f2c94c' : '#e3a90e',
  ['museum', 'art_gallery', 'attraction', 'monument', 'castle', 'theatre', 'cinema', 'place_of_worship'],
  dark ? '#e98cc0' : '#de5aa0',
  ['park', 'garden', 'playground', 'zoo'],
  dark ? '#7ccf6a' : '#3fa337',
  ['hospital', 'pharmacy', 'doctors'],
  dark ? '#f07e7e' : '#e5484d',
  ['lodging', 'hotel'],
  dark ? '#a99cf2' : '#7c6ae0',
  dark ? '#a0a0a8' : '#8e8e96',
];

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:ja'], ['get', 'name:en'], ['get', 'name']];
const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];

const cls = (...classes: string[]): ExpressionSpecification => ['match', ['get', 'class'], classes, true, false];
const notTunnel: ExpressionSpecification = ['!=', ['get', 'brunnel'], 'tunnel'];

// ズームに応じた線幅
const width = (stops: [number, number][]): ExpressionSpecification =>
  ['interpolate', ['exponential', 1.6], ['zoom'], ...stops.flat()] as ExpressionSpecification;

export function buildMapStyle(dark: boolean): StyleSpecification {
  const c = dark ? palette.dark : palette.light;
  const src = 'openmaptiles';

  const roadPair = (
    id: string,
    filter: ExpressionSpecification,
    fill: string,
    casing: string,
    w: [number, number][],
    minzoom = 0,
  ): LayerSpecification[] => [
    {
      id: `${id}-case`,
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      minzoom,
      filter: ['all', filter, notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': casing, 'line-width': width(w.map(([z, v]) => [z, v + 1.5])) },
    },
    {
      id,
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      minzoom,
      filter: ['all', filter, notTunnel],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': fill, 'line-width': width(w) },
    },
  ];

  const layers: LayerSpecification[] = [
    { id: 'background', type: 'background', paint: { 'background-color': c.land } },

    // ---- 土地利用 ----
    {
      id: 'landuse-urban',
      type: 'fill',
      source: src,
      'source-layer': 'landuse',
      filter: cls('residential', 'commercial', 'retail', 'industrial', 'neighbourhood'),
      paint: { 'fill-color': c.urban },
    },
    { id: 'landuse-hospital', type: 'fill', source: src, 'source-layer': 'landuse', filter: cls('hospital'), paint: { 'fill-color': c.hospital } },
    { id: 'landuse-school', type: 'fill', source: src, 'source-layer': 'landuse', filter: cls('school', 'university', 'college'), paint: { 'fill-color': c.school } },
    { id: 'landcover-wood', type: 'fill', source: src, 'source-layer': 'landcover', filter: cls('wood', 'forest'), paint: { 'fill-color': c.wood } },
    { id: 'landcover-grass', type: 'fill', source: src, 'source-layer': 'landcover', filter: cls('grass', 'farmland', 'wetland'), paint: { 'fill-color': c.park, 'fill-opacity': 0.7 } },
    { id: 'landcover-sand', type: 'fill', source: src, 'source-layer': 'landcover', filter: cls('sand'), paint: { 'fill-color': c.sand } },
    { id: 'park', type: 'fill', source: src, 'source-layer': 'park', paint: { 'fill-color': c.park } },
    { id: 'landuse-green', type: 'fill', source: src, 'source-layer': 'landuse', filter: cls('cemetery', 'stadium', 'pitch', 'playground', 'garden'), paint: { 'fill-color': c.park, 'fill-opacity': 0.8 } },
    { id: 'aeroway-area', type: 'fill', source: src, 'source-layer': 'aeroway', filter: ['==', ['geometry-type'], 'Polygon'], paint: { 'fill-color': c.airport } },

    // ---- 水 ----
    { id: 'water', type: 'fill', source: src, 'source-layer': 'water', paint: { 'fill-color': c.water } },
    {
      id: 'waterway',
      type: 'line',
      source: src,
      'source-layer': 'waterway',
      paint: { 'line-color': c.water, 'line-width': width([[10, 0.5], [16, 3]]) },
    },

    // ---- 建物 ----
    {
      id: 'building',
      type: 'fill',
      source: src,
      'source-layer': 'building',
      minzoom: 14,
      paint: {
        'fill-color': c.building,
        'fill-outline-color': c.buildingLine,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, 1],
      },
    },

    // ---- 道路 ----
    { id: 'aeroway-runway', type: 'line', source: src, 'source-layer': 'aeroway', filter: cls('runway'), paint: { 'line-color': c.roadCase, 'line-width': width([[10, 1], [16, 20]]) } },
    {
      id: 'path',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      minzoom: 15,
      filter: cls('path', 'track'),
      paint: { 'line-color': c.roadCase, 'line-width': 1, 'line-dasharray': [2, 1.5] },
    },
    ...roadPair('road-minor', cls('minor', 'service'), c.road, c.roadCase, [[13, 0.5], [16, 5], [18, 14]], 12),
    ...roadPair('road-major', cls('primary', 'secondary', 'tertiary'), c.major, c.majorCase, [[8, 0.5], [12, 2], [16, 9], [18, 20]], 7),
    ...roadPair('road-motorway', cls('motorway', 'trunk'), c.motorway, c.motorwayCase, [[5, 0.6], [10, 2], [14, 5], [18, 22]], 5),
    {
      id: 'rail',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      minzoom: 10,
      filter: ['all', cls('rail'), notTunnel],
      paint: { 'line-color': c.rail, 'line-width': width([[10, 0.6], [16, 2]]) },
    },
    {
      id: 'boundary',
      type: 'line',
      source: src,
      'source-layer': 'boundary',
      filter: ['all', ['<=', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': c.boundary, 'line-width': 1, 'line-dasharray': [3, 2] },
    },

    // ---- ラベル ----
    {
      id: 'water-label',
      type: 'symbol',
      source: src,
      'source-layer': 'water_name',
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12, 'text-letter-spacing': 0.05 },
      paint: { 'text-color': c.waterText, 'text-halo-color': c.halo, 'text-halo-width': 1 },
    },
    {
      id: 'place-neighbourhood',
      type: 'symbol',
      source: src,
      'source-layer': 'place',
      minzoom: 14,
      filter: cls('quarter', 'neighbourhood'),
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 10.5, 'text-letter-spacing': 0.04, 'text-padding': 8 },
      paint: { 'text-color': c.textMuted, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'road-label',
      type: 'symbol',
      source: src,
      'source-layer': 'transportation_name',
      minzoom: 14,
      filter: cls('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor'),
      layout: { 'symbol-placement': 'line', 'text-field': NAME, 'text-font': FONT, 'text-size': 10.5 },
      paint: { 'text-color': c.textMuted, 'text-halo-color': c.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'park-label',
      type: 'symbol',
      source: src,
      'source-layer': 'poi',
      minzoom: 13,
      filter: cls('park', 'garden'),
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 11, 'text-max-width': 8 },
      paint: { 'text-color': c.parkText, 'text-halo-color': c.halo, 'text-halo-width': 1.2 },
    },
    {
      id: 'poi-dot',
      type: 'circle',
      source: src,
      'source-layer': 'poi',
      minzoom: 15,
      filter: ['all', ['<=', ['get', 'rank'], 25], ['!', cls('park', 'garden', 'railway', 'bus')]],
      paint: {
        'circle-radius': 4.5,
        'circle-color': poiColor(dark),
        'circle-stroke-color': c.halo,
        'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'poi-label',
      type: 'symbol',
      source: src,
      'source-layer': 'poi',
      minzoom: 15,
      filter: ['all', ['<=', ['get', 'rank'], 25], ['!', cls('park', 'garden', 'railway', 'bus')]],
      layout: {
        'text-field': NAME,
        'text-font': FONT,
        'text-size': 11,
        'text-anchor': 'left',
        'text-offset': [0.7, 0],
        'text-max-width': 8,
        'text-optional': true,
      },
      paint: { 'text-color': poiColor(dark), 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'station-dot',
      type: 'circle',
      source: src,
      'source-layer': 'poi',
      minzoom: 12,
      filter: ['all', cls('railway'), ['==', ['get', 'subclass'], 'station']],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 16, 5],
        'circle-color': c.station,
        'circle-stroke-color': c.halo,
        'circle-stroke-width': 1.5,
      },
    },
    {
      id: 'station-label',
      type: 'symbol',
      source: src,
      'source-layer': 'poi',
      minzoom: 13,
      filter: ['all', cls('railway'), ['==', ['get', 'subclass'], 'station']],
      layout: {
        'text-field': NAME,
        'text-font': FONT,
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.6],
        'text-optional': true,
      },
      paint: { 'text-color': c.station, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'airport-label',
      type: 'symbol',
      source: src,
      'source-layer': 'aerodrome_label',
      minzoom: 8,
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12 },
      paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.4 },
    },
    {
      id: 'place-suburb',
      type: 'symbol',
      source: src,
      'source-layer': 'place',
      minzoom: 11,
      filter: cls('suburb'),
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 14] },
      paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'place-town',
      type: 'symbol',
      source: src,
      'source-layer': 'place',
      minzoom: 9,
      maxzoom: 14,
      filter: cls('town'),
      layout: { 'text-field': NAME, 'text-font': FONT, 'text-size': 12 },
      paint: { 'text-color': c.text, 'text-halo-color': c.halo, 'text-halo-width': 1.5 },
    },
    {
      id: 'place-city',
      type: 'symbol',
      source: src,
      'source-layer': 'place',
      maxzoom: 14,
      filter: cls('city'),
      layout: {
        'text-field': NAME,
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 5, 12, 12, 17],
      },
      paint: { 'text-color': c.textStrong, 'text-halo-color': c.halo, 'text-halo-width': 1.8 },
    },
  ];

  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: { [src]: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers,
  };
}
