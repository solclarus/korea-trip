import generatedPaths from '../data/paths.generated.json';
import type { CategoryId, Currency, Expense, Move, MoveMode, Place, Transfer, Trip, Visit, Wallet } from '../types';

// ---------- 表示設定 ----------

export const CATEGORIES: { id: CategoryId; label: string; color: string }[] = [
  { id: 'food', label: '食事', color: 'var(--series-1)' },
  { id: 'transport', label: '交通', color: 'var(--series-2)' },
  { id: 'shopping', label: '買い物', color: 'var(--series-3)' },
  { id: 'sightseeing', label: '観光', color: 'var(--series-4)' },
  { id: 'cafe', label: 'カフェ', color: 'var(--series-5)' },
  { id: 'lodging', label: '宿泊', color: 'var(--series-6)' },
  { id: 'fee', label: '手数料', color: 'var(--series-7)' },
  { id: 'friend', label: '友人の分', color: 'var(--series-8)' },
  { id: 'other', label: 'その他', color: 'var(--neutral)' },
];
/** 「English · 한국어」の副表記。正式名称が英語で name と同じなら英語は省く */
export const altNames = (p: Place) => [p.nameEn !== p.name ? p.nameEn : null, p.nameKo].filter(Boolean).join(' · ');

export const categoryOf = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

export const DAY_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'];

export const MODE_LABEL: Record<MoveMode, string> = {
  flight: '飛行機',
  train: '鉄道',
  subway: '地下鉄',
  bus: 'バス',
  taxi: 'タクシー',
  walk: '徒歩',
};


// ---------- 時刻 ----------
// タイムゾーンを持たない現地時刻として扱う（JST/KSTは同じ+09:00）。

export const toMin = (s: string) => {
  const [d, t = '00:00'] = s.split('T');
  const [y, mo, da] = d.split('-').map(Number);
  const [h, mi] = t.split(':').map(Number);
  return Date.UTC(y, mo - 1, da, h, mi) / 60000;
};

const WEEKDAY = ['日', '月', '火', '水', '木', '金', '土'];
export const fmtTime = (min: number) => {
  const d = new Date(min * 60000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
};
export const fmtDate = (min: number) => {
  const d = new Date(min * 60000);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}（${WEEKDAY[d.getUTCDay()]}）`;
};
export const dateKey = (s: string) => s.slice(0, 10);
/** 「1時間46分」の形の所要時間 */
export const fmtDuration = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}時間${m ? `${m}分` : ''}` : `${m}分`;
};

export const tripDays = (trip: Trip) => {
  const days: string[] = [];
  for (let m = toMin(trip.startDate); m <= toMin(trip.endDate); m += 1440) {
    days.push(new Date(m * 60000).toISOString().slice(0, 10));
  }
  return days;
};

// ---------- お金 ----------

export const toJpy = (trip: Trip, e: Pick<Expense, 'amount' | 'currency'>) => e.amount * trip.fx[e.currency];
export const toKrw = (trip: Trip, e: Pick<Expense, 'amount' | 'currency'>) => toJpy(trip, e) / trip.fx.KRW;

export const fmtMoney = (value: number, cur: Currency) =>
  (cur === 'JPY' ? '¥' : '₩') + Math.round(value).toLocaleString('ja-JP');

/** 実際に支払った通貨ごとの合計（ウォン → 円の順） */
export type Amounts = Partial<Record<Currency, number>>;
const CURRENCY_ORDER: Currency[] = ['KRW', 'JPY'];

export const sumByCurrency = (expenses: Pick<Expense, 'amount' | 'currency'>[]): Amounts => {
  const out: Amounts = {};
  for (const e of expenses) out[e.currency] = (out[e.currency] ?? 0) + e.amount;
  return out;
};

/** 「₩309,750 + ¥68,000」の形で表示 */
export const fmtAmounts = (a: Amounts) =>
  CURRENCY_ORDER.filter((c) => a[c]).map((c) => fmtMoney(a[c]!, c)).join(' + ') || fmtMoney(0, 'KRW');

/** 円換算した合計（グラフの長さや「≈」表示用） */
export const amountsInJpy = (trip: Trip, a: Amounts) =>
  CURRENCY_ORDER.reduce((s, c) => s + (a[c] ?? 0) * trip.fx[c], 0);

// ---------- 財布 ----------

export const walletOf = (trip: Trip, id?: string) => trip.wallets.find((w) => w.id === id);

export interface WalletSummary {
  wallet: Wallet;
  /** 入ってきた額 */
  inflow: number;
  /** 他の財布へ移した額 */
  outflow: number;
  /** 支払いに使った額（財布の通貨。card は円換算） */
  spent: number;
  balance: number;
}

export const summarizeWallets = (trip: Trip): WalletSummary[] =>
  trip.wallets.map((wallet) => {
    const inflow = trip.transfers.filter((t) => t.to === wallet.id).reduce((s, t) => s + t.received, 0);
    const outflow = trip.transfers
      .filter((t) => t.from === wallet.id)
      .reduce((s, t) => s + (t.sent ?? t.received), 0);
    const spent = trip.expenses
      .filter((e) => e.payment === wallet.id)
      .reduce((s, e) => s + (e.currency === wallet.currency ? e.amount : toJpy(trip, e) / trip.fx[wallet.currency]), 0);
    return { wallet, inflow, outflow, spent, balance: inflow - outflow - spent };
  });

// ---------- 地理 ----------

export type LatLng = [number, number];

export const haversineKm = ([la1, lo1]: LatLng, [la2, lo2]: LatLng) => {
  const R = 6371;
  const r = Math.PI / 180;
  const dLa = (la2 - la1) * r;
  const dLo = (lo2 - lo1) * r;
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export const pathLengthKm = (path: LatLng[]) =>
  path.slice(1).reduce((sum, p, i) => sum + haversineKm(path[i], p), 0);

/** path 上の割合 f (0..1) の地点 */
export const pointAlong = (path: LatLng[], f: number): LatLng => {
  const total = pathLengthKm(path);
  let target = total * Math.min(1, Math.max(0, f));
  for (let i = 1; i < path.length; i++) {
    const seg = haversineKm(path[i - 1], path[i]);
    if (target <= seg || i === path.length - 1) {
      const k = seg === 0 ? 0 : Math.min(1, target / seg);
      return [path[i - 1][0] + (path[i][0] - path[i - 1][0]) * k, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * k];
    }
    target -= seg;
  }
  return path[path.length - 1];
};

// ---------- 旅行データの派生 ----------

export interface Model {
  trip: Trip;
  days: string[];
  place: (id: string) => Place;
  movePath: (m: Move) => LatLng[];
  moveKm: (m: Move) => number;
  /** 時系列順の滞在・移動 */
  events: Event[];
  start: number;
  end: number;
  positionAt: (t: number) => LatLng;
  eventAt: (t: number) => SpatialEvent | undefined;
}

export type Event =
  | { kind: 'visit'; id: string; start: number; end: number; day: string; visit: Visit; expenses: Expense[]; transfers: Transfer[] }
  | { kind: 'move'; id: string; start: number; end: number; day: string; move: Move; expenses: Expense[] }
  /** 場所がわからない支払い（交通系ICの乗車など） */
  | { kind: 'payment'; id: string; start: number; end: number; day: string; expense: Expense }
  /** 場所がわからない両替・チャージ */
  | { kind: 'transfer'; id: string; start: number; end: number; day: string; transfer: Transfer };

export type SpatialEvent = Extract<Event, { kind: 'visit' | 'move' }>;

export const buildModel = (trip: Trip): Model => {
  const placeMap = new Map(trip.places.map((p) => [p.id, p]));
  const place = (id: string) => {
    const p = placeMap.get(id);
    if (!p) throw new Error(`unknown placeId: ${id}`);
    return p;
  };
  // 優先順：GPSログ（move.path） → 生成経路（npm run paths） → 直線
  const generated = generatedPaths as unknown as Record<string, LatLng[]>;
  const movePath = (m: Move): LatLng[] =>
    m.path ?? generated[m.id] ?? [
      [place(m.from).lat, place(m.from).lng],
      [place(m.to).lat, place(m.to).lng],
    ];
  const moveKm = (m: Move) => pathLengthKm(movePath(m));

  const spatial: SpatialEvent[] = [
    ...trip.visits.map((v) => ({
      kind: 'visit' as const,
      id: v.id,
      start: toMin(v.arrive),
      end: toMin(v.depart),
      day: dateKey(v.arrive),
      visit: v,
      // 同じ地点に複数回滞在する場合（ホテルなど）は時間帯で振り分ける
      expenses: trip.expenses.filter(
        (e) => e.placeId === v.placeId && toMin(e.at) >= toMin(v.arrive) && toMin(e.at) <= toMin(v.depart),
      ),
      transfers: trip.transfers.filter(
        (t) => t.at && t.placeId === v.placeId && toMin(t.at) >= toMin(v.arrive) && toMin(t.at) <= toMin(v.depart),
      ),
    })),
    ...trip.moves.map((m) => ({
      kind: 'move' as const,
      id: m.id,
      start: toMin(m.depart),
      end: toMin(m.arrive),
      day: dateKey(m.depart),
      move: m,
      expenses: trip.expenses.filter((e) => e.moveId === m.id),
    })),
  ].sort((a, b) => a.start - b.start || (a.kind === 'move' ? 1 : -1));

  // 滞在・移動に紐づかなかった支払い・両替は、単独の出来事としてタイムラインに並べる
  const attachedExpenses = new Set(spatial.flatMap((e) => e.expenses.map((x) => x.id)));
  const attachedTransfers = new Set(spatial.flatMap((e) => (e.kind === 'visit' ? e.transfers.map((x) => x.id) : [])));
  const loose: Event[] = [
    ...trip.expenses
      .filter((x) => !x.prepaid && !attachedExpenses.has(x.id))
      .map((x) => ({
        kind: 'payment' as const,
        id: x.id,
        start: toMin(x.at),
        end: toMin(x.endAt ?? x.at),
        day: dateKey(x.at),
        expense: x,
      })),
    ...trip.transfers
      .filter((x) => x.at && !attachedTransfers.has(x.id))
      .map((x) => ({ kind: 'transfer' as const, id: x.id, start: toMin(x.at!), end: toMin(x.at!), day: dateKey(x.at!), transfer: x })),
  ];
  const events: Event[] = [...spatial, ...loose].sort((a, b) => a.start - b.start || order(a) - order(b));

  const start = events[0]?.start ?? toMin(trip.startDate);
  const end = Math.max(...events.map((e) => e.end), toMin(trip.startDate));

  /** 時刻 t にいた場所（滞在・移動）。場所のない出来事は対象外 */
  const eventAt = (t: number) => {
    let last: SpatialEvent | undefined;
    for (const e of spatial) {
      if (e.start > t) break;
      last = e;
      if (t <= e.end) return e;
    }
    return last;
  };

  const positionAt = (t: number): LatLng => {
    const e = eventAt(t);
    if (!e) {
      const p = place(trip.visits[0].placeId);
      return [p.lat, p.lng];
    }
    if (e.kind === 'visit') {
      const p = place(e.visit.placeId);
      return [p.lat, p.lng];
    }
    const f = e.end === e.start ? 1 : (t - e.start) / (e.end - e.start);
    return pointAlong(movePath(e.move), f);
  };

  return { trip, days: tripDays(trip), place, movePath, moveKm, events, start, end, positionAt, eventAt };
};

/** 表示中の地点の通し番号（同じ地点は最初の訪問の番号）。地図のピンとタイムラインで共通 */
export const stopNumbers = (events: Event[]) => {
  const out = new Map<string, number>();
  for (const e of events) if (e.kind === 'visit' && !out.has(e.visit.placeId)) out.set(e.visit.placeId, out.size + 1);
  return out;
};

const order = (e: Event) => ({ visit: 0, transfer: 1, payment: 2, move: 3 })[e.kind];
