import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { CategoryId, Currency, Expense } from '@/types';
import {
  CATEGORIES,
  amountsInJpy,
  categoryOf,
  fmtDate,
  fmtMoney,
  fmtAmounts,
  fmtTime,
  moveLabel,
  stationsLabel,
  sumByCurrency,
  summarizeWallets,
  toJpy,
  toMin,
  walletOf,
  type Model,
} from '@/lib/core';

interface Props {
  model: Model;
  /** 表示中の日程の支払い */
  expenses: Expense[];
  onSelectPlace: (id: string) => void;
}

// お金：通貨ごとの合計 → 何に使ったか → お財布（両替・チャージ・残高）→ 支払いの記録
export function MoneyView({ model, expenses, onSelectPlace }: Props) {
  const [category, setCategory] = useState<CategoryId | null>(null);
  const { trip } = model;
  const totals = sumByCurrency(expenses);
  const walletsUsed = (cur: Currency) =>
    [...new Set(expenses.filter((e) => e.currency === cur).map((e) => walletOf(trip, e.payment)?.name).filter(Boolean))].join('・');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {(['KRW', 'JPY'] as const).map(
          (c) =>
            totals[c] != null && (
              <Card key={c} className="gap-1 py-5">
                <CardContent className="px-5">
                  <p className="text-sm font-medium text-muted-foreground">{c === 'KRW' ? 'ウォンで払った' : '円で払った'}</p>
                  <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{fmtMoney(totals[c]!, c)}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{walletsUsed(c)}</p>
                </CardContent>
              </Card>
            ),
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground tabular-nums">
        円にするとあわせて ≈ {fmtMoney(amountsInJpy(trip, totals), 'JPY')}（₩100 = ¥{(trip.fx.KRW * 100).toFixed(2)}・両替の実績から）
      </p>

      <Card>
        <CardHeader>
          <CardTitle>何に使った？</CardTitle>
          <CardDescription>押すと、そのカテゴリの支払いだけを下に表示</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryBars model={model} expenses={expenses} active={category} onToggle={(c) => setCategory((cur) => (cur === c ? null : c))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>お財布</CardTitle>
          <CardDescription>引き出し・両替・チャージと、いまの残高（全日程）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <Wallets model={model} />
          <Flow model={model} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            支払いの記録
            {category && (
              <Badge variant="secondary" asChild>
                <button type="button" onClick={() => setCategory(null)}>
                  {categoryOf(category).label}だけ
                  <X />
                </button>
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentList model={model} expenses={category ? expenses.filter((e) => e.category === category) : expenses} onSelectPlace={onSelectPlace} />
        </CardContent>
      </Card>
    </div>
  );
}

/** カテゴリ別の横棒。長さは円換算でそろえ、数字は払った通貨のまま */
function CategoryBars({
  model,
  expenses,
  active,
  onToggle,
}: {
  model: Model;
  expenses: Expense[];
  active: CategoryId | null;
  onToggle: (c: CategoryId) => void;
}) {
  const total = expenses.reduce((s, e) => s + toJpy(model.trip, e), 0);
  const rows = CATEGORIES.map((c) => {
    const items = expenses.filter((e) => e.category === c.id);
    return { ...c, amounts: sumByCurrency(items), value: items.reduce((s, e) => s + toJpy(model.trip, e), 0), count: items.length };
  })
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-1">
      {rows.map((r) => (
        <Tooltip key={r.id}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onToggle(r.id)}
              aria-pressed={active === r.id}
              className={cn(
                'grid w-full grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted',
                active && active !== r.id && 'opacity-40',
              )}
            >
              <span className="text-sm">{r.label}</span>
              <span className="h-2.5">
                <span className="block h-full min-w-1 rounded-r-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
              </span>
              <span className="flex flex-col items-end text-sm font-medium tabular-nums">
                {(['KRW', 'JPY'] as const).map((c) => r.amounts[c] != null && <span key={c}>{fmtMoney(r.amounts[c]!, c)}</span>)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {r.count}件・円換算 ≈ {fmtMoney(r.value, 'JPY')}（{((r.value / total) * 100).toFixed(1)}%）
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

/** 財布ごとの残高。入金のうち、移した分と使った分を1本の棒で */
function Wallets({ model }: { model: Model }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {summarizeWallets(model.trip).map(({ wallet, inflow, outflow, spent, balance }) => (
        <div key={wallet.id} className="rounded-xl border p-4">
          <p className="text-sm text-muted-foreground">{wallet.name}</p>
          {wallet.kind === 'card' ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">{fmtMoney(spent, wallet.currency)}</p>
              <p className="text-xs text-muted-foreground">利用額（円換算）</p>
            </>
          ) : (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">{fmtMoney(balance, wallet.currency)}</p>
              <p className="text-xs text-muted-foreground">残高</p>
              <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
                <span style={{ width: `${pct(outflow, inflow)}%`, background: 'var(--series-1)' }} />
                <span style={{ width: `${pct(spent, inflow)}%`, background: 'var(--series-2)' }} />
              </div>
              <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs tabular-nums">
                <dt className="text-muted-foreground">入金</dt>
                <dd className="text-right">{fmtMoney(inflow, wallet.currency)}</dd>
                {outflow > 0 && (
                  <>
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="size-1.5 rounded-full" style={{ background: 'var(--series-1)' }} />
                      移した
                    </dt>
                    <dd className="text-right">−{fmtMoney(outflow, wallet.currency)}</dd>
                  </>
                )}
                <dt className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full" style={{ background: 'var(--series-2)' }} />
                  使った
                </dt>
                <dd className="text-right">−{fmtMoney(spent, wallet.currency)}</dd>
              </dl>
              {balance < 0 && <p className="mt-2 text-xs">⚠ 残高がマイナス：チャージか支払いの記録漏れ？</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

const pct = (v: number, total: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);

/** 引き出し → 両替 → チャージ の流れ（キャッシュバックもここだけに出す） */
function Flow({ model }: { model: Model }) {
  const { trip } = model;
  const transfers = [...trip.transfers].sort((a, b) => (a.at ? toMin(a.at) : -Infinity) - (b.at ? toMin(b.at) : -Infinity));
  return (
    <ol className="relative space-y-5 border-l pl-6">
      {transfers.map((t) => {
        const from = walletOf(trip, t.from);
        const to = walletOf(trip, t.to)!;
        const sent = t.sent ?? t.received;
        const exchange = from && from.currency !== to.currency;
        return (
          <li key={t.id} className="relative">
            <span className="absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-foreground/50 bg-card" />
            <p className="text-xs text-muted-foreground tabular-nums">
              {t.at ? `${fmtDate(toMin(t.at))} ${fmtTime(toMin(t.at))}` : '出発前'}
              {t.placeId && `・${model.place(t.placeId).name}`}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="font-medium">{from?.name ?? t.source ?? '外部'}</span>
              <ArrowRight className="size-3.5 text-muted-foreground" />
              <span className="font-medium">{to.name}</span>
              <span className="ml-auto font-semibold tabular-nums">
                {exchange && <span className="font-normal text-muted-foreground">{fmtMoney(sent, from.currency)} → </span>}
                {fmtMoney(t.received, to.currency)}
              </span>
            </div>
            {t.note && <p className="mt-0.5 text-xs text-muted-foreground">{t.note}</p>}
            {exchange && (
              <p className="text-xs text-muted-foreground tabular-nums">
                ¥1 = ₩{(t.received / sent).toFixed(2)}（₩100 = ¥{((sent / t.received) * 100).toFixed(2)}）
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** 日ごとの支払い一覧。押すとその場所を地図で表示 */
function PaymentList({ model, expenses, onSelectPlace }: { model: Model; expenses: Expense[]; onSelectPlace: (id: string) => void }) {
  const sorted = [...expenses].sort((a, b) => toMin(a.at) - toMin(b.at));
  const days = model.days.filter((d) => sorted.some((e) => e.at.startsWith(d)));
  const placeIdOf = (e: Expense) => e.placeId ?? model.trip.moves.find((m) => m.id === e.moveId)?.to;
  const whereOf = (e: Expense) => {
    if (e.placeId) return model.place(e.placeId).name;
    const m = model.trip.moves.find((m) => m.id === e.moveId);
    return m ? stationsLabel(m) || moveLabel(m) : '';
  };

  if (sorted.length === 0) return <p className="text-sm text-muted-foreground">支払いはありません</p>;
  return (
    <div className="space-y-6">
      {days.map((day) => {
        const items = sorted.filter((e) => e.at.startsWith(day));
        return (
          <section key={day}>
            <h3 className="flex flex-wrap items-baseline justify-between gap-x-3 border-b pb-2 text-sm font-semibold">
              <span>
                {model.days.indexOf(day) + 1}日目 <span className="font-normal text-muted-foreground">{fmtDate(toMin(day))}</span>
              </span>
              <span className="tabular-nums">{fmtAmounts(sumByCurrency(items))}</span>
            </h3>
            <ul className="mt-1">
              {items.map((e) => {
                const c = categoryOf(e.category);
                const placeId = placeIdOf(e);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => placeId && onSelectPlace(placeId)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-muted"
                    >
                      <span className="size-2 shrink-0 rounded-full" style={{ background: c.color }} aria-label={c.label} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm">
                          {e.item}
                          {e.prepaid && <Badge variant="outline">事前払い</Badge>}
                          {e.estimated && <Badge variant="outline">金額は仮</Badge>}
                        </span>
                        <span className="truncate text-xs text-muted-foreground tabular-nums">
                          {fmtTime(toMin(e.at))}
                          {e.endAt && `→${fmtTime(toMin(e.endAt))}`}
                          {whereOf(e) && `・${whereOf(e)}`}
                          {e.payment && `・${walletOf(model.trip, e.payment)?.name}`}
                        </span>
                      </span>
                      <span className="flex flex-col items-end text-sm font-semibold tabular-nums">
                        <span className={cn(e.estimated && 'est')}>{fmtMoney(e.amount, e.currency)}</span>
                        {e.currency !== 'JPY' && <span className="text-xs font-normal text-muted-foreground">≈ {fmtMoney(toJpy(model.trip, e), 'JPY')}</span>}
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
