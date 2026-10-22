import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { ArrowLeftRight, ChevronDown, Star } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Expense, Photo, Transfer, Trip } from '@/types';
import {
  DAY_COLORS,
  MODE_LABEL,
  altNames,
  categoryOf,
  fmtDuration,
  fmtMoney,
  fmtTime,
  stationsLabel,
  stopNumbers,
  walletOf,
  type Event,
  type Model,
} from '@/lib/core';
import { MODE_ICON } from './icons';

interface Props {
  model: Model;
  events: Event[];
  activeEventId: string | null;
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  onSeek: (t: number) => void;
  /** 再生中、いまの出来事までリストを追いかける */
  autoScroll: boolean;
}

const WEEKDAY = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];

// 旅の日記：日ごとに大きな見出し、左に時刻、細い線でつないだ出来事。
// 金額・メモは各出来事を開いたときだけ出す。写真があれば大きく見せ、なくても文字だけで成り立つ。
export function Timeline({ model, events, activeEventId, selectedPlaceId, onSelectPlace, onSeek, autoScroll }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const numbers = useMemo(() => stopNumbers(events), [events]);
  const days = model.days.filter((d) => events.some((e) => e.day === d));

  useEffect(() => {
    if (!activeEventId || !autoScroll) return;
    listRef.current?.querySelector(`[data-id="${activeEventId}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 地図でピンを選んだら、その場所までスクロール
  useEffect(() => {
    if (!selectedPlaceId) return;
    listRef.current?.querySelector(`[data-place="${selectedPlaceId}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selectedPlaceId]);

  return (
    <div ref={listRef} className="space-y-16">
      {days.map((day) => {
        const n = model.days.indexOf(day) + 1;
        const dayEvents = events.filter((e) => e.day === day);
        return (
          <section key={day} style={{ ['--day' as string]: DAY_COLORS[n - 1] }}>
            <DayHeader model={model} day={day} n={n} events={dayEvents} />
            <ol className="mt-8">
              {dayEvents.map((e, i) => (
                <Entry
                  key={e.id}
                  model={model}
                  event={e}
                  last={i === dayEvents.length - 1}
                  number={e.kind === 'visit' ? numbers.get(e.visit.placeId) : undefined}
                  active={e.id === activeEventId}
                  selected={e.kind === 'visit' && e.visit.placeId === selectedPlaceId}
                  onSelectPlace={onSelectPlace}
                  onSeek={onSeek}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

function DayHeader({ model, day, n, events }: { model: Model; day: string; n: number; events: Event[] }) {
  const d = new Date(Date.parse(day));
  const places = new Set(events.flatMap((e) => (e.kind === 'visit' ? [e.visit.placeId] : []))).size;
  const km = events.reduce((s, e) => s + (e.kind === 'move' && e.move.mode !== 'flight' ? model.moveKm(e.move) : 0), 0);
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b pb-4">
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--day)' }}>
          {n}日目
        </p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
          {d.getUTCMonth() + 1}月{d.getUTCDate()}日
          <span className="ml-3 text-lg font-medium text-muted-foreground sm:text-xl">{WEEKDAY[d.getUTCDay()]}</span>
        </h2>
      </div>
      <p className="text-sm text-muted-foreground tabular-nums">
        {places}か所・{km.toFixed(1)}km
      </p>
    </header>
  );
}

interface EntryProps {
  model: Model;
  event: Event;
  last: boolean;
  number?: number;
  active: boolean;
  selected: boolean;
  onSelectPlace: (id: string) => void;
  onSeek: (t: number) => void;
}

/** 1つの出来事。左に時刻、細い縦線の上に印、右に中身 */
function Entry({ model, event: e, last, number, active, selected, onSelectPlace, onSeek }: EntryProps) {
  const isMove = e.kind === 'move';
  const flight = isMove && e.move.mode === 'flight';
  const estimated = (e.kind === 'visit' && e.visit.estimated) || (e.kind === 'move' && e.move.estimated);

  // 縦線：移動はその日の色で太く（飛行機は破線）、それ以外は細い線
  const railStyle = isMove
    ? flight
      ? { backgroundImage: 'linear-gradient(var(--day) 55%, transparent 0)', backgroundSize: '3px 9px', opacity: 0.55 }
      : { background: 'var(--day)', opacity: 0.4 }
    : undefined;

  return (
    <li
      data-id={e.id}
      data-place={e.kind === 'visit' ? e.visit.placeId : undefined}
      className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3.5rem_minmax(0,1fr)] sm:gap-x-4"
    >
      <button
        type="button"
        onClick={() => onSeek(e.start)}
        className={cn('self-start pt-0.5 text-right text-sm tabular-nums', e.kind === 'visit' ? 'font-semibold' : 'text-muted-foreground')}
      >
        <span className={cn(estimated && 'est')}>{fmtTime(e.start)}</span>
        {e.kind === 'visit' && (
          <span className={cn('block text-xs font-normal text-muted-foreground', estimated && 'est')}>{fmtTime(e.end)}</span>
        )}
      </button>

      <div className={cn('relative min-w-0 pl-10', e.kind === 'visit' ? 'pb-10' : isMove ? 'pb-8' : 'pb-5')}>
        {!last && (
          <span
            aria-hidden
            className={cn('absolute top-0 -bottom-px left-3', isMove ? 'w-[3px] -translate-x-1/2 rounded-full' : 'w-px bg-border')}
            style={railStyle}
          />
        )}
        <Marker event={e} number={number} active={active} />
        {e.kind === 'visit' && (
          <VisitBody
            model={model}
            event={e}
            selected={selected}
            onSelect={() => {
              onSelectPlace(e.visit.placeId);
              onSeek(e.start);
            }}
          />
        )}
        {e.kind === 'move' && <MoveBody model={model} event={e} />}
        {e.kind === 'payment' && <PaymentBody trip={model.trip} expense={e.expense} start={e.start} end={e.end} />}
        {e.kind === 'transfer' && <TransferBody trip={model.trip} transfer={e.transfer} />}
        {e.kind === 'photo' && <PhotoGrid photos={[e.photo]} />}
      </div>
    </li>
  );
}

/** 縦線の上の印：滞在はピン番号（地図と同じ）、移動は手段のアイコン、それ以外は小さな点 */
function Marker({ event: e, number, active }: { event: Event; number?: number; active: boolean }) {
  const base = 'absolute top-0 left-0 grid place-items-center rounded-full';
  if (e.kind === 'visit') {
    return (
      <span
        className={cn(base, 'size-6 text-[11px] font-bold text-white tabular-nums ring-4 ring-background')}
        style={{ background: 'var(--day)', boxShadow: active ? '0 0 0 6px var(--background), 0 0 0 8px var(--day)' : undefined }}
      >
        {number}
      </span>
    );
  }
  if (e.kind === 'move') {
    const Icon = MODE_ICON[e.move.mode];
    return (
      <span
        className={cn(base, 'size-6 border-2 ring-4 ring-background')}
        style={{ borderColor: 'var(--day)', color: active ? '#fff' : 'var(--day)', background: active ? 'var(--day)' : 'var(--background)' }}
      >
        <Icon className="size-3.5" />
      </span>
    );
  }
  return <span className={cn(base, 'top-1.5 left-[7px] size-2.5 bg-muted-foreground/35 ring-4 ring-background')} />;
}

/** 開閉できる出来事：見出しの右に丸いアイコン、開くと詳細 */
function Expandable({ head, details, className }: { head: ReactNode; details?: ReactNode; className?: string }) {
  if (!details) return <div className={className}>{head}</div>;
  return (
    <Collapsible className={cn('group/entry', className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{head}</div>
        <CollapsibleTrigger
          className="-mt-0.5 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          aria-label="詳細"
        >
          <ChevronDown className="size-4 transition-transform group-data-[state=open]/entry:rotate-180" />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
        <div className="pt-3">{details}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function VisitBody({
  model,
  event: e,
  selected,
  onSelect,
}: {
  model: Model;
  event: Extract<Event, { kind: 'visit' }>;
  selected: boolean;
  onSelect: () => void;
}) {
  const p = model.place(e.visit.placeId);
  const hasDetails = !!e.visit.note || e.expenses.length + e.transfers.length > 0;
  return (
    <div className="-mt-1">
      <Expandable
        head={
          <button type="button" onClick={onSelect} className="text-left">
            <h3
              className={cn('text-xl font-bold tracking-tight text-balance sm:text-2xl', selected && 'underline decoration-2 underline-offset-4')}
              style={selected ? { textDecorationColor: 'var(--day)' } : undefined}
            >
              {p.name}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{altNames(p)}</p>
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{fmtDuration(e.end - e.start)}</span>
              {p.area && <span>{p.area}</span>}
              {e.visit.rating && <Rating value={e.visit.rating} />}
            </p>
          </button>
        }
        details={hasDetails ? <Details trip={model.trip} note={e.visit.note} expenses={e.expenses} transfers={e.transfers} /> : undefined}
      />
      {e.photos.length > 0 && <PhotoGrid photos={e.photos} className="mt-4" />}
    </div>
  );
}

function MoveBody({ model, event: e }: { model: Model; event: Extract<Event, { kind: 'move' }> }) {
  const m = e.move;
  return (
    <Expandable
      className="pt-0.5"
      head={
        <div className="text-sm">
          <p>
            <span className="font-semibold">{MODE_LABEL[m.mode]}</span>
            <span className="text-muted-foreground tabular-nums">
              ・{fmtDuration(e.end - e.start)}・{model.moveKm(m).toFixed(1)}km
            </span>
          </p>
          {m.line && <p className="text-muted-foreground">{m.line}</p>}
          {m.stations && m.stations.length > 0 && (
            <p className="mt-1.5">
              <span className="font-medium">{stationsLabel(m)}</span>
              <span className="block text-xs text-muted-foreground">{stationsLabel(m, 'ko')}</span>
            </p>
          )}
        </div>
      }
      details={e.expenses.length > 0 ? <Details trip={model.trip} expenses={e.expenses} /> : undefined}
    />
  );
}

function PaymentBody({ trip, expense: x, start, end }: { trip: Trip; expense: Expense; start: number; end: number }) {
  return (
    <Expandable
      head={
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground">{x.item}</span>
          {x.endAt && (
            <span className="tabular-nums">
              ・{fmtTime(start)}→{fmtTime(end)}（{end - start}分）
            </span>
          )}
        </p>
      }
      details={<Details trip={trip} expenses={[x]} />}
    />
  );
}

function TransferBody({ trip, transfer: t }: { trip: Trip; transfer: Transfer }) {
  const to = walletOf(trip, t.to)!;
  const from = walletOf(trip, t.from);
  return (
    <Expandable
      head={<p className="text-sm">{from && from.currency !== to.currency ? `両替して${to.name}へ` : `${to.name}にチャージ`}</p>}
      details={<Details trip={trip} transfers={[t]} />}
    />
  );
}

/** 開いたときの中身：メモ、両替・チャージ、支払い */
function Details({ trip, note, expenses = [], transfers = [] }: { trip: Trip; note?: string; expenses?: Expense[]; transfers?: Transfer[] }) {
  return (
    <div className="space-y-3 rounded-xl bg-muted/70 p-4 text-sm">
      {note && <p className="leading-relaxed text-foreground/80">{note}</p>}
      {transfers.length + expenses.length > 0 && (
        <ul className={cn('space-y-2.5', note && 'border-t border-border pt-3')}>
          {transfers.map((t) => {
            const to = walletOf(trip, t.to)!;
            const from = walletOf(trip, t.from);
            return (
              <li key={t.id} className="flex items-start gap-3">
                <ArrowLeftRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p>{t.note ?? `${from?.name ?? t.source} → ${to.name}`}</p>
                  <p className="text-xs text-muted-foreground">
                    {from?.name ?? t.source ?? '外部'} → {to.name}
                  </p>
                </div>
                <span className="font-semibold whitespace-nowrap text-positive tabular-nums">+{fmtMoney(t.received, to.currency)}</span>
              </li>
            );
          })}
          {expenses.map((x) => (
            <li key={x.id} className="flex items-start gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: categoryOf(x.category).color }} />
              <div className="min-w-0 flex-1">
                <p>{x.item}</p>
                <p className="text-xs text-muted-foreground">
                  {[categoryOf(x.category).label, walletOf(trip, x.payment)?.name, x.memo].filter(Boolean).join('・')}
                </p>
              </div>
              <span className={cn('font-semibold whitespace-nowrap tabular-nums', x.estimated && 'est')}>{fmtMoney(x.amount, x.currency)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`満足度 ${value}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3', i < value ? 'fill-current text-foreground/70' : 'text-muted-foreground/40')} />
      ))}
    </span>
  );
}

/** 写真：1枚目を大きく、残りは小さく並べる */
function PhotoGrid({ photos, className }: { photos: Photo[]; className?: string }) {
  const [first, ...rest] = photos;
  return (
    <figure className={cn('space-y-2', className)}>
      <img src={first.src} alt={first.caption ?? ''} loading="lazy" className="aspect-[4/3] w-full rounded-xl bg-muted object-cover" />
      {rest.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {rest.map((p) => (
            <img key={p.id} src={p.src} alt={p.caption ?? ''} loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />
          ))}
        </div>
      )}
      {first.caption && <figcaption className="text-xs text-muted-foreground">{first.caption}</figcaption>}
    </figure>
  );
}
