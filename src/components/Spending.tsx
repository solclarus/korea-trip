import { useState, type ReactNode } from 'react';
import type { CategoryId, Expense } from '../types';
import {
  CATEGORIES,
  categoryOf,
  fmtDate,
  fmtMoney,
  fmtTime,
  fmtAmounts,
  sumByCurrency,
  toJpy,
  toMin,
  moveLabel,
  stationsLabel,
  walletOf,
  type Model,
} from '../lib/core';

// ---------- ツールチップ ----------

type Tip = { x: number; y: number; content: ReactNode } | null;
const useTip = () => {
  const [tip, setTip] = useState<Tip>(null);
  const bind = (content: ReactNode) => ({
    onMouseMove: (ev: React.MouseEvent) => setTip({ x: ev.clientX, y: ev.clientY, content }),
    onMouseLeave: () => setTip(null),
  });
  const node = tip && (
    <div className="tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.content}
    </div>
  );
  return { bind, node };
};

// ---------- カテゴリ別 ----------

interface CommonProps {
  model: Model;
  expenses: Expense[];
}

export function CategoryBars({
  model,
  expenses,
  active,
  onToggle,
}: CommonProps & { active: CategoryId | null; onToggle: (c: CategoryId) => void }) {
  // 棒の長さだけは円換算でそろえる。表示は支払った通貨のまま
  const total = expenses.reduce((s, e) => s + toJpy(model.trip, e), 0);
  const rows = CATEGORIES.map((c) => {
    const items = expenses.filter((e) => e.category === c.id);
    return { ...c, amounts: sumByCurrency(items), value: items.reduce((s, e) => s + toJpy(model.trip, e), 0), count: items.length };
  })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const { bind, node } = useTip();

  return (
    <div className="cat-bars">
      {rows.map((r) => (
        <button
          key={r.id}
          className={`cat-row${active && active !== r.id ? ' is-dim' : ''}${active === r.id ? ' is-active' : ''}`}
          onClick={() => onToggle(r.id)}
          aria-pressed={active === r.id}
          {...bind(
            <>
              <strong>{r.label}</strong>
              <div className="num">{fmtAmounts(r.amounts)}</div>
              <div className="muted">
                {r.count}件・円換算 ≈ {fmtMoney(r.value, 'JPY')}（{((r.value / total) * 100).toFixed(1)}%）
              </div>
            </>,
          )}
        >
          <span className="cat-label">{r.label}</span>
          <span className="cat-track">
            <span className="cat-fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </span>
          <span className="cat-value num">
            {(['KRW', 'JPY'] as const).map((c) => r.amounts[c] != null && <span key={c}>{fmtMoney(r.amounts[c]!, c)}</span>)}
          </span>
        </button>
      ))}
      {node}
    </div>
  );
}

// ---------- 支払い一覧（日ごと） ----------

export function ExpenseList({
  model,
  expenses,
  onSelectPlace,
}: CommonProps & { onSelectPlace: (id: string) => void }) {
  const sorted = [...expenses].sort((a, b) => toMin(a.at) - toMin(b.at));
  const days = model.days.filter((d) => sorted.some((e) => e.at.startsWith(d)));
  const placeIdOf = (e: Expense) => e.placeId ?? model.trip.moves.find((m) => m.id === e.moveId)?.to;
  const whereOf = (e: Expense) => {
    if (e.placeId) return model.place(e.placeId).name;
    const m = model.trip.moves.find((m) => m.id === e.moveId);
    return m ? stationsLabel(m) || moveLabel(m) : '';
  };

  if (sorted.length === 0) return <p className="muted small">支払いはありません</p>;
  return (
    <div className="pay-list">
      {days.map((day) => {
        const items = sorted.filter((e) => e.at.startsWith(day));
        const n = model.days.indexOf(day) + 1;
        return (
          <section key={day}>
            <h3 className="pay-day">
              <span>
                {n}日目 <span className="muted">{fmtDate(toMin(day))}</span>
              </span>
              <span className="num">{fmtAmounts(sumByCurrency(items))}</span>
            </h3>
            <ul>
              {items.map((e) => {
                const c = categoryOf(e.category);
                const placeId = placeIdOf(e);
                return (
                  <li key={e.id}>
                    <button onClick={() => placeId && onSelectPlace(placeId)}>
                      <span className="pay-icon" style={{ background: c.color }} aria-label={c.label} />
                      <span className="pay-main">
                        <span className="pay-item">
                          {e.item}
                          {e.prepaid && <span className="tag">事前払い</span>}
                          {e.estimated && <span className="tag">金額は仮</span>}
                        </span>
                        <span className="pay-sub">
                          {fmtTime(toMin(e.at))}
                          {e.endAt && `→${fmtTime(toMin(e.endAt))}`}
                          {whereOf(e) && `・${whereOf(e)}`}
                          {e.payment && `・${walletOf(model.trip, e.payment)?.name}`}
                        </span>
                      </span>
                      <span className="pay-amount num">
                        {fmtMoney(e.amount, e.currency)}
                        {e.currency !== 'JPY' && <span className="pay-orig">≈ {fmtMoney(toJpy(model.trip, e), 'JPY')}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
