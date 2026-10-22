import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { trip } from '@/data/trip';
import { DAY_COLORS, buildModel, fmtAmounts, fmtDate, fmtMoney, amountsInJpy, fmtTime, moveLabel, stationsLabel, sumByCurrency, toMin } from '@/lib/core';
import { TripMap, type Inset } from '@/components/TripMap';
import { Timeline } from '@/components/Timeline';
import { MoneyView } from '@/components/Money';

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
  const desktop = useMediaQuery('(min-width: 1024px)');

  const events = useMemo(() => (scope === 'all' ? model.events : model.events.filter((e) => e.day === scope)), [model, scope]);
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
  const scopedExpenses = useMemo(() => (scope === 'all' ? trip.expenses : trip.expenses.filter((e) => e.at.startsWith(scope))), [scope]);
  const totals = sumByCurrency(scopedExpenses);
  const moves = events.flatMap((e) => (e.kind === 'move' ? [e.move] : []));
  const groundKm = moves.filter((m) => m.mode !== 'flight').reduce((s, m) => s + model.moveKm(m), 0);
  const placeCount = new Set(events.flatMap((e) => (e.kind === 'visit' ? [e.visit.placeId] : []))).size;

  const selectPlace = (id: string) => setSelectedPlaceId((cur) => (cur === id ? null : id));
  const seek = (t: number) => {
    setPlayhead(t);
    setPlaying(false);
  };

  // ツールバーの高さ（地図カードをその下に貼り付けるため）
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
        ? [moveLabel(activeEvent.move), stationsLabel(activeEvent.move)].filter(Boolean).join('　')
        : '';

  const stats = [
    { label: scope === 'all' ? '期間' : '日付', value: scope === 'all' ? `${model.days.length}日間` : fmtDate(toMin(scope)) },
    { label: '訪れた場所', value: `${placeCount}か所` },
    { label: '移動（飛行機を除く）', value: `${groundKm.toFixed(1)}km` },
    { label: '支出', value: fmtAmounts(totals), sub: `≈ ${fmtMoney(amountsInJpy(trip, totals), 'JPY')}` },
  ];

  return (
    <TooltipProvider>
      <div className="min-h-svh" style={{ ['--toolbar-h' as string]: `${toolbarH}px` }}>
        <header className="mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-8 sm:pt-20">
          <p className="flex flex-wrap items-center gap-3 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Seoul · {trip.startDate.replaceAll('-', '.')} — {trip.endDate.slice(5).replace('-', '.')}
            {trip.subtitle && (
              <Badge variant="outline" className="tracking-normal normal-case">
                {trip.subtitle}
              </Badge>
            )}
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-7xl">{trip.title}</h1>
          <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t pt-6 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-muted-foreground">{s.label}</dt>
                <dd className="mt-1 text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{s.value}</dd>
                {s.sub && <dd className="text-xs text-muted-foreground tabular-nums">{s.sub}</dd>}
              </div>
            ))}
          </dl>
        </header>

        <div ref={toolbarRef} className="sticky top-0 z-[1100] border-y bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3 sm:px-8">
            <ToggleGroup
              type="single"
              value={scope}
              onValueChange={(v) => v && setScope(v)}
              variant="outline"
              size="sm"
              className="max-w-full flex-wrap"
              aria-label="日程"
            >
              <ToggleGroupItem value="all">ぜんぶ</ToggleGroupItem>
              {model.days.map((d, i) => (
                <ToggleGroupItem key={d} value={d} className="gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: DAY_COLORS[i] }} />
                  {i + 1}日目
                  <span className="hidden text-xs text-muted-foreground sm:inline">{fmtDate(toMin(d)).replace(/（.）/, '')}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Tabs value={view} onValueChange={(v) => setView(v as View)}>
              <TabsList>
                <TabsTrigger value="trip" className="px-3">
                  旅程
                </TabsTrigger>
                <TabsTrigger value="money" className="px-3">
                  お金
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="mx-auto grid max-w-6xl gap-10 px-5 pt-8 pb-24 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
          <aside
            aria-label="地図"
            className="lg:sticky lg:top-[calc(var(--toolbar-h)+1.5rem)] lg:order-2 lg:self-start"
          >
            <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
              <div className="h-72 sm:h-96 lg:h-[calc(100svh-var(--toolbar-h)-9rem)]">
                <TripMap
                  model={model}
                  events={events}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={selectPlace}
                  playhead={playhead}
                  follow={playing}
                  inset={NO_INSET}
                />
              </div>
              <div className="flex items-center gap-3 border-t px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => {
                    if (playhead >= range.end) setPlayhead(range.start);
                    setPlaying((p) => !p);
                  }}
                  aria-label={playing ? '一時停止' : '再生'}
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90"
                >
                  {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex gap-2 text-xs">
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {fmtDate(playhead)} {fmtTime(playhead)}
                    </span>
                    <span className="truncate text-muted-foreground">{nowLabel}</span>
                  </p>
                  <input
                    type="range"
                    min={range.start}
                    max={range.end}
                    value={playhead}
                    onChange={(e) => seek(Number(e.target.value))}
                    aria-label="時刻"
                    className="mt-1 block w-full accent-foreground"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
                  aria-label="再生速度"
                  className={cn('rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums transition hover:bg-accent')}
                >
                  {SPEEDS[speed].label}
                </button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 lg:order-1">
            {view === 'trip' ? (
              <>
                <Timeline
                  model={model}
                  events={events}
                  activeEventId={activeEvent?.id ?? null}
                  selectedPlaceId={selectedPlaceId}
                  onSelectPlace={selectPlace}
                  onSeek={seek}
                  autoScroll={playing && desktop}
                />
                {trip.apps && trip.apps.length > 0 && (
                  <section className="mt-16 border-t pt-8">
                    <h2 className="text-sm font-semibold text-muted-foreground">旅で使ったアプリ</h2>
                    <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                      {trip.apps.map((a) => (
                        <li key={a.name}>
                          <p className="font-semibold">{a.name}</p>
                          <p className="text-sm text-muted-foreground">{a.note}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <MoneyView model={model} expenses={scopedExpenses} onSelectPlace={selectPlace} />
            )}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
