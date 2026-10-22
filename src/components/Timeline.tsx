import { useEffect, useMemo, useRef, useState } from 'react';
import type { Expense, Transfer, Trip } from '../types';
import {
  DAY_COLORS,
  altNames,
  MODE_LABEL,
  categoryOf,
  fmtDate,
  fmtDuration,
  fmtMoney,
  fmtTime,
  stationsLabel,
  stopNumbers,
  walletOf,
  type Event,
  type Model,
} from '../lib/core';
import { Icon } from './Icon';

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

// 左に時刻、真ん中に縦のレールと印、右に中身。
// 滞在はピン番号（地図と同じ）つきのカード、移動はレール上の行、支払い・両替は小さな行。
export function Timeline({ model, events, activeEventId, selectedPlaceId, onSelectPlace, onSeek, autoScroll }: Props) {
  const { trip } = model;
  const listRef = useRef<HTMLOListElement>(null);
  const numbers = useMemo(() => stopNumbers(events), [events]);
  // 金額などの詳細は、項目を押したときだけ開く
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  useEffect(() => {
    if (!activeEventId || !autoScroll) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-id="${activeEventId}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 地図でピンを選んだら、その場所までスクロール
  useEffect(() => {
    if (!selectedPlaceId) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-place="${selectedPlaceId}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [selectedPlaceId]);

  let lastDay = '';
  return (
    <ol className="timeline" ref={listRef}>
      {events.map((e) => {
        const dayHeader = e.day !== lastDay;
        lastDay = e.day;
        const active = e.id === activeEventId;
        const header = dayHeader && <DayHeader model={model} day={e.day} events={events} />;
        const isOpen = open.has(e.id);
        const dayColor = DAY_COLORS[model.days.indexOf(e.day)];

        // 場所に紐づかない支払い（乗車・お店など）
        if (e.kind === 'payment') {
          const x = e.expense;
          const ride = !!x.endAt;
          return (
            <li key={e.id} data-id={e.id} className={`tl-item tl-small${active ? ' is-active' : ''}`}>
              {header}
              <button
                className="tl-row"
                aria-expanded={isOpen}
                onClick={() => {
                  onSeek(e.start);
                  toggle(e.id);
                }}
              >
                <span className="tl-when num">
                  <Time t={e.start} />
                </span>
                <span className="tl-node">
                  <span className="mini-node" style={{ color: categoryOf(x.category).color }}>
                    <Icon name={ride ? 'subway' : 'receipt'} size={12} />
                  </span>
                </span>
                <span className="tl-body">
                  <span className="tl-small-main">
                    <span className="tl-small-title">{x.item}</span>
                    <span className="tl-sub">
                      {[categoryOf(x.category).label, ride && `${fmtTime(e.start)}→${fmtTime(e.end)}（${e.end - e.start}分）`]
                        .filter(Boolean)
                        .join('・')}
                    </span>
                    {isOpen && <Details trip={trip} expenses={[x]} />}
                  </span>
                  <More open={isOpen} />
                </span>
              </button>
            </li>
          );
        }

        // 場所に紐づかない両替・チャージ
        if (e.kind === 'transfer') {
          const t = e.transfer;
          const from = walletOf(trip, t.from);
          const to = walletOf(trip, t.to)!;
          return (
            <li key={e.id} data-id={e.id} className={`tl-item tl-small${active ? ' is-active' : ''}`}>
              {header}
              <button
                className="tl-row"
                aria-expanded={isOpen}
                onClick={() => {
                  onSeek(e.start);
                  toggle(e.id);
                }}
              >
                <span className="tl-when num">
                  <Time t={e.start} />
                </span>
                <span className="tl-node">
                  <span className="mini-node">
                    <Icon name="exchange" size={12} />
                  </span>
                </span>
                <span className="tl-body">
                  <span className="tl-small-main">
                    <span className="tl-small-title">{from && from.currency !== to.currency ? `両替して${to.name}へ` : `${to.name}にチャージ`}</span>
                    {isOpen && <Details trip={trip} transfers={[t]} />}
                  </span>
                  <More open={isOpen} />
                </span>
              </button>
            </li>
          );
        }

        if (e.kind === 'move') {
          const m = e.move;
          return (
            <li
              key={e.id}
              data-id={e.id}
              className={`tl-item tl-move${m.mode === 'flight' ? ' is-flight' : ''}${active ? ' is-active' : ''}`}
              style={{ ['--day' as string]: dayColor }}
            >
              {header}
              <button
                className="tl-row"
                aria-expanded={e.expenses.length > 0 ? isOpen : undefined}
                onClick={() => {
                  onSeek(e.start);
                  toggle(e.id);
                }}
              >
                <span className="tl-when num">
                  <Time t={e.start} est={m.estimated} />
                </span>
                <span className="tl-node">
                  <span className="mode-node">
                    <Icon name={m.mode} size={15} />
                  </span>
                </span>
                <span className="tl-body">
                  <span className="tl-move-main">
                    <span className="tl-move-title">
                      {MODE_LABEL[m.mode]}
                      <span className="tl-move-stat num">
                        {fmtDuration(e.end - e.start)}・{model.moveKm(m).toFixed(1)}km
                      </span>
                    </span>
                    {m.line && <span className="tl-sub">{m.line}</span>}
                    {m.stations && m.stations.length > 0 && (
                      <span className="tl-stations">
                        <span>{stationsLabel(m)}</span>
                        <span className="tl-stations-ko">{stationsLabel(m, 'ko')}</span>
                      </span>
                    )}
                    {isOpen && e.expenses.length > 0 && <Details trip={trip} expenses={e.expenses} />}
                  </span>
                  {e.expenses.length > 0 && <More open={isOpen} />}
                </span>
              </button>
            </li>
          );
        }

        const p = model.place(e.visit.placeId);
        const selected = p.id === selectedPlaceId;
        const hasDetails = !!e.visit.note || e.expenses.length + e.transfers.length > 0;
        return (
          <li
            key={e.id}
            data-id={e.id}
            data-place={p.id}
            className={`tl-item tl-visit${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}
            style={{ ['--day' as string]: dayColor }}
          >
            {header}
            <button
              className="tl-row"
              aria-expanded={hasDetails ? isOpen : undefined}
              onClick={() => {
                onSelectPlace(p.id);
                onSeek(e.start);
                toggle(e.id);
              }}
            >
              <span className="tl-when num">
                <Time t={e.start} est={e.visit.estimated} />
                <span className="tl-when-end">
                  <Time t={e.end} est={e.visit.estimated} />
                </span>
              </span>
              <span className="tl-node">
                <span className="pin-node num">{numbers.get(p.id)}</span>
              </span>
              <div className="tl-body tl-card">
                <div className="tl-card-meta">
                  {fmtDuration(e.end - e.start)}の滞在
                  {p.area && <span>・{p.area}</span>}
                </div>
                <div className="tl-title">
                  {p.name}
                  {e.visit.rating && (
                    <span className="tl-rating" aria-label={`満足度 ${e.visit.rating}/5`}>
                      {'★'.repeat(e.visit.rating)}
                      <span className="muted">{'★'.repeat(5 - e.visit.rating)}</span>
                    </span>
                  )}
                </div>
                <div className="alt-names">{altNames(p)}</div>
                {hasDetails && <More open={isOpen} />}
                {isOpen && <Details trip={trip} note={e.visit.note} expenses={e.expenses} transfers={e.transfers} />}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** 押すと開く詳細があることを示す */
function More({ open }: { open: boolean }) {
  return (
    <span className={`tl-more${open ? ' is-open' : ''}`} aria-hidden title={open ? '閉じる' : '詳細'}>
      <Icon name="chevron" size={16} />
    </span>
  );
}

/** 金額・支払い方法・メモ。項目を開いたときだけ出す */
function Details({
  trip,
  note,
  expenses = [],
  transfers = [],
}: {
  trip: Trip;
  note?: string;
  expenses?: Expense[];
  transfers?: Transfer[];
}) {
  return (
    <span className="tl-details">
      {note && <span className="tl-note">{note}</span>}
      {transfers.map((t) => {
        const to = walletOf(trip, t.to)!;
        const from = walletOf(trip, t.from);
        return (
          <span key={t.id} className="tl-detail">
            <span className="tl-exp-icon">
              <Icon name="exchange" size={12} />
            </span>
            <span className="tl-detail-main">
              <span>{t.note ?? `${from?.name ?? t.source ?? ''} → ${to.name}`}</span>
              <span className="tl-sub">
                {from?.name ?? t.source ?? '外部'} → {to.name}
                {from && t.sent != null && from.currency !== to.currency && `・${fmtMoney(t.sent, from.currency)} を両替`}
              </span>
            </span>
            <span className="num tl-in">+{fmtMoney(t.received, to.currency)}</span>
          </span>
        );
      })}
      {expenses.map((x) => (
        <span key={x.id} className="tl-detail">
          <span className="tl-exp-icon">
            <span className="dot" style={{ background: categoryOf(x.category).color }} />
          </span>
          <span className="tl-detail-main">
            <span>{x.item}</span>
            <span className="tl-sub">{[categoryOf(x.category).label, walletOf(trip, x.payment)?.name, x.memo].filter(Boolean).join('・')}</span>
          </span>
          <span className="num">{fmtMoney(x.amount, x.currency)}</span>
        </span>
      ))}
    </span>
  );
}

/** 推定の時刻には点線の下線を引く */
function Time({ t, est }: { t: number; est?: boolean }) {
  return (
    <time className={est ? 'est' : undefined} title={est ? '時刻は推定' : undefined}>
      {fmtTime(t)}
    </time>
  );
}

function DayHeader({ model, day, events }: { model: Model; day: string; events: Event[] }) {
  const n = model.days.indexOf(day) + 1;
  const dayEvents = events.filter((e) => e.day === day);
  const places = new Set(dayEvents.flatMap((e) => (e.kind === 'visit' ? [e.visit.placeId] : []))).size;
  const km = dayEvents.reduce((s, e) => s + (e.kind === 'move' && e.move.mode !== 'flight' ? model.moveKm(e.move) : 0), 0);
  return (
    <div className="tl-day">
      <span className="tl-day-badge" style={{ background: DAY_COLORS[n - 1] }}>
        {n}日目
      </span>
      <span className="tl-day-date">{fmtDate(Date.parse(day) / 60000)}</span>
      <span className="tl-day-stats num">
        <span>
          <Icon name="pin" size={13} />
          {places}か所
        </span>
        <span>
          <Icon name="route" size={13} />
          {km.toFixed(1)}km
        </span>
      </span>
    </div>
  );
}
