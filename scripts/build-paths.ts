// 移動経路を生成して src/data/paths.generated.json に書き出す。
//   npm run paths
//
// - 鉄道（train / subway）: move.rail の路線を OpenStreetMap（Overpass API）から取り、
//   乗車駅〜降車駅の線路の形を最短経路で切り出す。駅までの徒歩も道路沿いにつなぐ。
// - 徒歩: OSRM（routing.openstreetmap.de）の歩行者ルート
// - バス / タクシー: OSRM の自動車ルート。move.via（停留所など）があればその順にたどる
// - 飛行機・move.path（GPSログ）があるものは対象外
//
// 取得結果は .cache/ に保存するので、2回目以降はネットワークに出ない。

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { trip } from '../src/data/trip.ts';
import type { Move, RailLeg } from '../src/types.ts';

type LL = [number, number]; // [lat, lng]

const UA = 'korea-trip-viewer/0.1 (personal trip log)';
const CACHE_DIR = new URL('../.cache/', import.meta.url);
const OUT = new URL('../src/data/paths.generated.json', import.meta.url);

// ---------- 取得（キャッシュ付き） ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cachedJson<T>(key: string, url: string, init?: RequestInit): Promise<T> {
  mkdirSync(CACHE_DIR, { recursive: true });
  const file = new URL(createHash('sha1').update(key).digest('hex') + '.json', CACHE_DIR);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, ...init?.headers } });
    if (res.ok) {
      const json = await res.json();
      writeFileSync(file, JSON.stringify(json));
      await sleep(1000); // 公開サーバーへの配慮
      return json as T;
    }
    if (attempt >= 3) throw new Error(`${res.status} ${res.statusText}: ${url}`);
    await sleep(5000 * attempt);
  }
}

// ---------- 道路（OSRM） ----------

/** a → (経由地) → b の道路沿いの経路 */
async function road(profile: 'foot' | 'car', a: LL, b: LL, via: LL[] = []): Promise<LL[]> {
  const coords = [a, ...via, b].map(([lat, lng]) => `${lng},${lat}`).join(';');
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await cachedJson<{ code: string; routes: { geometry: { coordinates: [number, number][] } }[] }>(url, url);
  if (res.code !== 'Ok' || !res.routes[0]) throw new Error(`OSRM: no route ${profile} ${a} → ${b}`);
  return res.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]);
}

// ---------- 鉄道（Overpass） ----------

interface OsmNode { type: 'node'; id: number; lat: number; lon: number; tags?: Record<string, string> }
interface OsmWay { type: 'way'; id: number; nodes: number[]; tags?: Record<string, string> }
interface OsmRel {
  type: 'relation';
  id: number;
  members: { type: 'node' | 'way'; ref: number; role: string }[];
  tags?: Record<string, string>;
}
type OsmEl = OsmNode | OsmWay | OsmRel;

const relationCache = new Map<number, Promise<OsmEl[]>>();
function relationElements(id: number) {
  if (!relationCache.has(id)) {
    const query = `[out:json][timeout:120];relation(${id});(._;>;);out body;`;
    relationCache.set(
      id,
      cachedJson<{ elements: OsmEl[] }>(`overpass:${query}`, 'https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
      }).then((r) => r.elements),
    );
  }
  return relationCache.get(id)!;
}

// 首都圏（ソウル・仁川・京畿）の範囲で駅を名前検索
async function stationByName(name: string): Promise<LL | null> {
  const n = norm(name);
  const query = `[out:json][timeout:60];nwr[railway~"^(station|halt)$"][name~"^${n}(역)?$"](37.2,126.3,37.8,127.3);out center;`;
  const res = await cachedJson<{ elements: { lat?: number; lon?: number; center?: { lat: number; lon: number } }[] }>(
    `overpass:${query}`,
    'https://overpass-api.de/api/interpreter',
    { method: 'POST', body: new URLSearchParams({ data: query }) },
  );
  const pts = res.elements.map((e) => e.center ?? { lat: e.lat!, lon: e.lon! }).filter((p) => p.lat != null);
  return pts.length ? [avg(pts.map((p) => p.lat)), avg(pts.map((p) => p.lon))] : null;
}

const norm = (s = '') => s.replace(/\(.*?\)|（.*?）/g, '').replace(/\s/g, '').replace(/역$/, '');

async function railLeg(leg: RailLeg): Promise<LL[]> {
  const els = await relationElements(leg.relation);
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  let rel: OsmRel | undefined;
  for (const e of els) {
    if (e.type === 'node') nodes.set(e.id, e);
    else if (e.type === 'way') ways.set(e.id, e);
    else if (e.id === leg.relation) rel = e;
  }
  if (!rel) throw new Error(`relation ${leg.relation} not found`);

  // 線路のグラフ（役割なしのメンバー way = 線路）
  const adj = new Map<number, { to: number; w: number }[]>();
  const link = (a: number, b: number) => {
    const na = nodes.get(a)!;
    const nb = nodes.get(b)!;
    const w = haversine([na.lat, na.lon], [nb.lat, nb.lon]);
    (adj.get(a) ?? adj.set(a, []).get(a)!).push({ to: b, w });
    (adj.get(b) ?? adj.set(b, []).get(b)!).push({ to: a, w });
  };
  for (const m of rel.members) {
    if (m.type !== 'way' || m.role !== '') continue;
    const way = ways.get(m.ref);
    way?.nodes.forEach((n, i) => i > 0 && link(way.nodes[i - 1], n));
  }

  // 駅の位置：停車位置（stop）を優先、なければホーム（platform）、それも無ければ駅名で検索
  const stationPos = async (name: string): Promise<LL> => {
    const want = norm(name);
    const named = (tags?: Record<string, string>) =>
      !!tags && [tags.name, tags['name:ko']].some((n) => norm(n) === want);
    for (const role of ['stop', 'platform']) {
      for (const m of rel!.members) {
        if (!m.role.startsWith(role)) continue;
        const el = m.type === 'node' ? nodes.get(m.ref) : ways.get(m.ref);
        if (!el || !named(el.tags)) continue;
        if (el.type === 'node') return [el.lat, el.lon];
        const pts = el.nodes.map((n) => nodes.get(n)!).filter(Boolean);
        return [avg(pts.map((p) => p.lat)), avg(pts.map((p) => p.lon))];
      }
    }
    // OSM の路線データに駅が登録されていないことがある → 駅名で探す
    const found = await stationByName(name);
    if (found) return found;
    throw new Error(`station "${name}" not found (relation ${leg.relation})`);
  };

  const nearest = (p: LL) => {
    let best = -1;
    let bestD = Infinity;
    for (const id of adj.keys()) {
      const n = nodes.get(id)!;
      const d = haversine(p, [n.lat, n.lon]);
      if (d < bestD) [best, bestD] = [id, d];
    }
    return best;
  };

  const a = nearest(await stationPos(leg.from));
  const b = nearest(await stationPos(leg.to));
  const ids = dijkstra(adj, a, b);
  if (!ids) throw new Error(`no track between ${leg.from} and ${leg.to} on ${leg.relation}`);
  return ids.map((id) => [nodes.get(id)!.lat, nodes.get(id)!.lon]);
}

function dijkstra(adj: Map<number, { to: number; w: number }[]>, start: number, goal: number) {
  const dist = new Map<number, number>([[start, 0]]);
  const prev = new Map<number, number>();
  const heap: [number, number][] = [[0, start]];
  const push = (item: [number, number]) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (u === goal) break;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (const { to, w } of adj.get(u) ?? []) {
      const nd = d + w;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
        push([nd, to]);
      }
    }
  }
  if (!dist.has(goal)) return null;
  const path = [goal];
  while (path[0] !== start) path.unshift(prev.get(path[0])!);
  return path;
}

// ---------- 幾何 ----------

const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function haversine([la1, lo1]: LL, [la2, lo2]: LL) {
  const r = Math.PI / 180;
  const a = Math.sin(((la2 - la1) * r) / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(((lo2 - lo1) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

// Douglas–Peucker（緯度経度をそのまま平面として扱う。数m単位の間引きなので十分）
function simplify(pts: LL[], tol = 0.00002): LL[] {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let maxD = 0;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], a, b);
    if (d > maxD) [maxD, idx] = [d, i];
  }
  if (maxD <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}
function segDist(p: LL, a: LL, b: LL) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

const join = (...parts: LL[][]) => parts.flat().filter((p, i, all) => i === 0 || p[0] !== all[i - 1][0] || p[1] !== all[i - 1][1]);
const round = (p: LL): LL => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];

// ---------- 本体 ----------

const placeLL = (id: string): LL => {
  const p = trip.places.find((x) => x.id === id);
  if (!p) throw new Error(`unknown place ${id}`);
  return [p.lat, p.lng];
};

async function buildMove(m: Move): Promise<LL[] | null> {
  const from = placeLL(m.from);
  const to = placeLL(m.to);
  switch (m.mode) {
    case 'flight':
      return null;
    case 'walk':
      return road('foot', from, to, m.via);
    case 'bus':
    case 'taxi':
      return road('car', from, to, m.via);
    case 'train':
    case 'subway': {
      if (!m.rail?.length) return null;
      const legs = await Promise.all(m.rail.map(railLeg));
      // 駅までの徒歩（駅が近ければ直結）
      const walk = async (a: LL, b: LL) => (haversine(a, b) < 0.08 ? [a, b] : road('foot', a, b));
      const first = legs[0][0];
      const last = legs[legs.length - 1].at(-1)!;
      return join(await walk(from, first), ...legs, await walk(last, to));
    }
  }
}

const paths: Record<string, LL[]> = {};
let failed = 0;
for (const m of trip.moves) {
  if (m.path) continue;
  try {
    const p = await buildMove(m);
    if (!p) continue;
    paths[m.id] = simplify(p).map(round);
    const km = paths[m.id].slice(1).reduce((s, q, i) => s + haversine(paths[m.id][i], q), 0);
    console.log(`✓ ${m.id} ${m.mode.padEnd(6)} ${m.from} → ${m.to}  ${km.toFixed(1)}km  ${paths[m.id].length}pts`);
  } catch (e) {
    failed++;
    console.error(`✗ ${m.id} ${m.from} → ${m.to}: ${(e as Error).message}`);
  }
}

writeFileSync(OUT, JSON.stringify(paths) + '\n');
console.log(`\n${Object.keys(paths).length} paths → src/data/paths.generated.json${failed ? `（失敗 ${failed}件・直線で表示）` : ''}`);
if (failed) process.exitCode = 1;
