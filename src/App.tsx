import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { trip } from './data/trip';
import type { CategoryId, Currency } from './types';
import { DAY_COLORS, amountsInJpy, buildModel, categoryOf, fmtAmounts, fmtDate, fmtMoney, fmtTime, sumByCurrency, toMin, walletOf } from './lib/core';
import { TripMap, type Inset } from './components/TripMap';
import { Timeline } from './components/Timeline';
import { CategoryBars, ExpenseList } from './components/Spending';
import { MoneyFlow } from './components/MoneyFlow';
import { Icon, type IconName } from './components/Icon';

type Scope = 'all' | string; // 'all' or YYYY-MM-DD
type View = 'trip' | 'money';

const SPEEDS = [
  { label: '×1', minPerTick: 1 },
  { label: '×5', minPerTick: 5 },
  { label: '×15', minPerTick: 15 },
];

// 地図は独立したカードなので、上に重なるものはない
const NO_INSET: Inset = { top: 0, right: 0, bottom: 0, left: 0 };

const useMediaQuery = (query: string) => {
  const mq = useMemo(() => window.matchMedia(query), [query]);
  const [match, setMatch] = useState(mq.matches);
  useEffect(() => {
    const on = (e: MediaQueryListEvent) => setMatch(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [mq]);
  return match;
};

export default function App() {
  const model = useMemo(() => buildModel(trip), []);
  const [scope, setScope] = useState<Scope>('all');
  const [view, setView] = useState<View>('trip');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const mobile = useMediaQuery('(max-width: 900px)');

  const events = useMemo(
    () => (scope === 'all' ? model.events : model.events.filter((e) => e.day === scope)),
    [model, scope],
  );
  const range = useMemo(() => {
    const start = events[0]?.start ?? model.start;
    const lastEnd = events[events.length - 1]?.end ?? model.end;
    // 1日表示ではホテル滞在など翌朝までの区間を当日中に切る
    return { start, end: scope === 'all' ? lastEnd : Math.min(lastEnd, toMin(scope) + 1439) };
  }, [events, model, scope]);

  // ---- 再生 ----
  const [playhead, setPlayhead] = useState(range.start);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    setPlayhead(range.start);
    setPlaying(false);
  }, [range.start]);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setPlayhead((t) => {
        const next = t + SPEEDS[speed].minPerTick;
        if (next >= range.end) {
          setPlaying(false);
          return range.end;
        }
        // 夜間（ホテル滞在中）は次の行動まで飛ばす
        const cur = model.eventAt(next);
        if (cur?.kind === 'visit' && cur.end - cur.start > 6 * 60 && next < cur.end - 30) return cur.end - 30;
        return next;
      });
    }, 60);
    return () => clearInterval(id);
  }, [playing, speed, range.end, model]);
  const activeEvent = model.eventAt(playhead);

  // ---- 集計 ----
  const scopedExpenses = useMemo(
    () => (scope === 'all' ? trip.expenses : trip.expenses.filter((e) => e.at.startsWith(scope))),
    [scope],
  );
  // 支払った通貨ごとに集計する（換算はあくまで参考）
  const totals = sumByCurrency(scopedExpenses);
  const totalJpy = amountsInJpy(trip, totals);
  const walletsUsed = (cur: Currency) =>
    [...new Set(scopedExpenses.filter((e) => e.currency === cur).map((e) => walletOf(trip, e.payment)?.name).filter(Boolean))].join('・');
  const moves = events.flatMap((e) => (e.kind === 'move' ? [e.move] : []));
  const groundKm = moves.filter((m) => m.mode !== 'flight').reduce((s, m) => s + model.moveKm(m), 0);
  const walkKm = moves.filter((m) => m.mode === 'walk').reduce((s, m) => s + model.moveKm(m), 0);
  const placeCount = new Set(events.flatMap((e) => (e.kind === 'visit' ? [e.visit.placeId] : []))).size;
  const dayN = scope === 'all' ? 0 : model.days.indexOf(scope) + 1;

  const selectPlace = (id: string) => setSelectedPlaceId((cur) => (cur === id ? null : id));
  const seek = (t: number) => {
    setPlayhead(t);
    setPlaying(false);
  };

  // ツールバーの高さ（日見出しをその下に貼り付けるため）
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarH, setToolbarH] = useState(64);
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setToolbarH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nowLabel =
    activeEvent?.kind === 'visit'
      ? model.place(activeEvent.visit.placeId).name
      : activeEvent?.kind === 'move'
        ? `${model.place(activeEvent.move.from).name} → ${model.place(activeEvent.move.to).name}`
        : '';

  return (
    <div className="app" style={{ ['--toolbar-h' as string]: `${toolbarH}px` }}>
      <header className="hero">
        <p className="eyebrow">
          {fmtDate(toMin(trip.startDate))} – {fmtDate(toMin(trip.endDate))}
          {trip.subtitle && <span className="badge">{trip.subtitle}</span>}
        </p>
        <h1>{trip.title}</h1>

        <div className="stats">
          <Stat
            icon="calendar"
            label={scope === 'all' ? '期間' : `${dayN}日目`}
            value={scope === 'all' ? `${model.days.length}日間` : fmtDate(toMin(scope))}
            accent={scope === 'all' ? undefined : DAY_COLORS[dayN - 1]}
          />
          <Stat icon="pin" label="訪れた場所" value={`${placeCount}か所`} />
          <Stat icon="route" label="移動距離" value={`${groundKm.toFixed(1)}km`} sub={walkKm > 0 ? `うち徒歩 ${walkKm.toFixed(1)}km・飛行機を除く` : '飛行機を除く'} />
          <Stat icon="wallet" label="支出" value={fmtAmounts(totals)} sub={`円にすると ≈ ${fmtMoney(totalJpy, 'JPY')}`} />
        </div>
      </header>

      <div className="toolbar" ref={toolbarRef}>
        <nav className="seg days" aria-label="日程">
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            ぜんぶ
          </button>
          {model.days.map((d, i) => (
            <button key={d} aria-pressed={scope === d} onClick={() => setScope(d)} style={{ ['--day' as string]: DAY_COLORS[i] }}>
              <span className="day-n">{i + 1}日目</span>
              <span className="day-date">{fmtDate(toMin(d)).replace(/（.）/, '')}</span>
            </button>
          ))}
        </nav>
        <div className="seg view-tabs" role="tablist">
          <button role="tab" aria-selected={view === 'trip'} onClick={() => setView('trip')}>
            旅程
          </button>
          <button role="tab" aria-selected={view === 'money'} onClick={() => setView('money')}>
            お金
          </button>
        </div>
      </div>

      <div className="layout">
        <main className="content">
          {view === 'trip' ? (
            <Timeline
              model={model}
              events={events}
              activeEventId={activeEvent?.id ?? null}
              selectedPlaceId={selectedPlaceId}
              onSelectPlace={selectPlace}
              onSeek={seek}
              autoScroll={playing && !mobile}
            />
          ) : (
            <div className="money-view">
              <section className="card">
                <div className="totals">
                  {(['KRW', 'JPY'] as const).map(
                    (c) =>
                      totals[c] != null && (
                        <div key={c} className="total">
                          <div className="total-label">{c === 'KRW' ? 'ウォンで払った' : '円で払った'}</div>
                          <div className="big-number num">{fmtMoney(totals[c]!, c)}</div>
                          <div className="big-sub">{walletsUsed(c)}</div>
                        </div>
                      ),
                  )}
                </div>
                <p className="big-note num">
                  円にするとあわせて ≈ {fmtMoney(totalJpy, 'JPY')}（₩100 = ¥{(trip.fx.KRW * 100).toFixed(2)}）
                </p>
              </section>

              <section className="card">
                <h2>何に使った？</h2>
                <CategoryBars
                  model={model}
                  expenses={scopedExpenses}
                  active={category}
                  onToggle={(c) => setCategory((cur) => (cur === c ? null : c))}
                />
              </section>

              <section className="card">
                <h2>お財布</h2>
                <MoneyFlow model={model} />
              </section>

              <section className="card">
                <h2>
                  支払いの記録
                  {category && (
                    <button className="chip" onClick={() => setCategory(null)}>
                      {categoryOf(category).label}だけ表示中 ✕
                    </button>
                  )}
                </h2>
                <ExpenseList
                  model={model}
                  expenses={category ? scopedExpenses.filter((e) => e.category === category) : scopedExpenses}
                  onSelectPlace={selectPlace}
                />
              </section>

              <p className="credit">
                レート ₩100 = ¥{(trip.fx.KRW * 100).toFixed(2)}（仁川での両替実績）
              </p>
            </div>
          )}
        </main>

        <aside className="map-card" aria-label="地図">
          <TripMap
            model={model}
            events={events}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={selectPlace}
            playhead={playhead}
            follow={playing}
            inset={NO_INSET}
          />

          <div className="player">
            <button
              className="play"
              onClick={() => {
                if (playhead >= range.end) setPlayhead(range.start);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? '一時停止' : '再生'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <div className="player-main">
              <div className="player-meta">
                <span className="num player-time">
                  {fmtDate(playhead)} {fmtTime(playhead)}
                </span>
                <span className="ellipsis">{nowLabel}</span>
              </div>
              <input
                type="range"
                min={range.start}
                max={range.end}
                value={playhead}
                onChange={(e) => seek(Number(e.target.value))}
                aria-label="時刻"
              />
            </div>
            <button className="speed" onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)} aria-label="再生速度">
              {SPEEDS[speed].label}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, sub, accent }: { icon: IconName; label: string; value: ReactNode; sub?: ReactNode; accent?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">
        <span className="stat-icon" style={accent ? { color: accent } : undefined}>
          <Icon name={icon} size={14} />
        </span>
        {label}
      </div>
      <div className="stat-value num">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
