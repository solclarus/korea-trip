import { useEffect, useRef } from 'react';
import {
  DAY_COLORS,
  MODE_ICON,
  altNames,
  MODE_LABEL,
  categoryOf,
  fmtDate,
  fmtMoney,
  fmtTime,
  fmtAmounts,
  sumByCurrency,
  walletOf,
  type Event,
  type Model,
} from '../lib/core';

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

export function Timeline({ model, events, activeEventId, selectedPlaceId, onSelectPlace, onSeek, autoScroll }: Props) {
  const { trip } = model;
  const listRef = useRef<HTMLOListElement>(null);

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

        // 場所がわからない支払い（乗車・お店など）
        if (e.kind === 'payment') {
          const x = e.expense;
          const ride = !!x.endAt;
          return (
            <li key={e.id} data-id={e.id} className="tl-loose">
              {dayHeader && <DayHeader model={model} day={e.day} events={events} />}
              <button className="tl-loose-body" onClick={() => onSeek(e.start)}>
                <span className="tl-loose-time num">{fmtTime(e.start)}</span>
                {ride ? (
                  <span className="tl-mode" aria-hidden>🚇</span>
                ) : (
                  <span className="tl-loose-dot" style={{ background: categoryOf(x.category).color }} aria-hidden />
                )}
                <span className="tl-loose-main">
                  {x.item}
                  <span className="muted">
                    {ride && `・${fmtTime(e.start)}→${fmtTime(e.end)}（${e.end - e.start}分）`}
                    {x.payment && `・${walletOf(trip, x.payment)?.name}`}
                  </span>
                  {x.memo && <span className="tl-memo">{x.memo}</span>}
                </span>
                <span className="num tl-amount">{fmtMoney(x.amount, x.currency)}</span>
              </button>
            </li>
          );
        }

        if (e.kind === 'transfer') {
          const t = e.transfer;
          const to = walletOf(trip, t.to)!;
          return (
            <li key={e.id} data-id={e.id} className="tl-loose">
              {dayHeader && <DayHeader model={model} day={e.day} events={events} />}
              <button className="tl-loose-body" onClick={() => onSeek(e.start)}>
                <span className="tl-loose-time num">{fmtTime(e.start)}</span>
                <span className="tl-mode" aria-hidden>⇄</span>
                <span className="tl-loose-main">{t.note ?? `${to.name}へ`}</span>
                <span className="num tl-amount tl-in">+{fmtMoney(t.received, to.currency)}</span>
              </button>
            </li>
          );
        }

        const spent = sumByCurrency(e.expenses);
        if (e.kind === 'move') {
          const m = e.move;
          return (
            <li key={e.id} data-id={e.id} className={`tl-move${active ? ' is-active' : ''}`}>
              {dayHeader && <DayHeader model={model} day={e.day} events={events} />}
              <button className="tl-move-body" onClick={() => onSeek(e.start)}>
                <span className="tl-mode" aria-hidden>{MODE_ICON[m.mode]}</span>
                <span>
                  {MODE_LABEL[m.mode]}
                  {m.line && <span className="muted">・{m.line}</span>}
                  {m.estimated && <span className="tag">時刻は推定</span>}
                </span>
                <span className="muted num">
                  {e.end - e.start}分・{model.moveKm(m).toFixed(1)}km
                </span>
                {e.expenses.length > 0 && <span className="num tl-amount">{fmtAmounts(spent)}</span>}
              </button>
            </li>
          );
        }

        const p = model.place(e.visit.placeId);
        const selected = p.id === selectedPlaceId;
        return (
          <li key={e.id} data-id={e.id} data-place={p.id} className={`tl-visit${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`}>
            {dayHeader && <DayHeader model={model} day={e.day} events={events} />}
            <button
              className="tl-visit-body"
              onClick={() => {
                onSelectPlace(p.id);
                onSeek(e.start);
              }}
            >
              <div className="tl-time num">
                {fmtTime(e.start)}
                <span className="muted">{fmtTime(e.end)}</span>
              </div>
              <div className="tl-main">
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
                {e.visit.estimated && <span className="tag tag-block">時刻は推定</span>}
                {e.visit.note && <p className="tl-note">{e.visit.note}</p>}
                {e.transfers.length > 0 && (
                  <ul className="tl-expenses tl-transfers">
                    {e.transfers.map((t) => (
                      <li key={t.id}>
                        <span className="tl-transfer-icon" aria-hidden>⇄</span>
                        <span>{t.note ?? `${walletOf(trip, t.from)?.name ?? ''} → ${walletOf(trip, t.to)?.name}`}</span>
                        <span className="num">{fmtMoney(t.received, walletOf(trip, t.to)!.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {e.expenses.length > 0 && (
                  <ul className="tl-expenses">
                    {e.expenses.map((x) => (
                      <li key={x.id}>
                        <span className="dot" style={{ background: categoryOf(x.category).color }} />
                        <span>{x.item}</span>
                        <span className="num">{fmtMoney(x.amount, x.currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function DayHeader({ model, day, events }: { model: Model; day: string; events: Event[] }) {
  const n = model.days.indexOf(day) + 1;
  const dayEvents = events.filter((e) => e.day === day);
  const places = new Set(dayEvents.flatMap((e) => (e.kind === 'visit' ? [e.visit.placeId] : []))).size;
  const km = dayEvents.reduce((s, e) => s + (e.kind === 'move' && e.move.mode !== 'flight' ? model.moveKm(e.move) : 0), 0);
  const spent = sumByCurrency(model.trip.expenses.filter((x) => x.at.startsWith(day)));
  return (
    <div className="tl-day">
      <span className="tl-day-badge" style={{ background: DAY_COLORS[n - 1] }}>{n}日目</span>
      <span className="tl-day-date">{fmtDate(Date.parse(day) / 60000)}</span>
      <span className="tl-day-stats num">
        {places}か所・{km.toFixed(1)}km・{fmtAmounts(spent)}
      </span>
    </div>
  );
}
