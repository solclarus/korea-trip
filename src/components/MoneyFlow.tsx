import { fmtDate, fmtMoney, fmtTime, summarizeWallets, toMin, walletOf, type Model } from '../lib/core';

// 引き出し → 両替 → チャージ の流れと、財布ごとの残高
export function MoneyFlow({ model }: { model: Model }) {
  const { trip } = model;
  const summaries = summarizeWallets(trip);
  const transfers = [...trip.transfers].sort((a, b) => (a.at ? toMin(a.at) : -Infinity) - (b.at ? toMin(b.at) : -Infinity));

  return (
    <div className="money">
      <ol className="flow">
        {transfers.map((t) => {
          const from = walletOf(trip, t.from);
          const to = walletOf(trip, t.to)!;
          const sent = t.sent ?? t.received;
          return (
            <li key={t.id} className="flow-step">
              <div className="flow-when muted num">
                {t.at ? `${fmtDate(toMin(t.at))} ${fmtTime(toMin(t.at))}` : '出発前'}
                {t.placeId && `・${model.place(t.placeId).name}`}
              </div>
              <div className="flow-row">
                <span className="flow-node">{from ? from.name : (t.source ?? '外部')}</span>
                <span className="flow-arrow" aria-hidden>
                  →
                </span>
                <span className="flow-node is-to">{to.name}</span>
                <span className="flow-amount num">
                  {from && from.currency !== to.currency && (
                    <span className="muted">{fmtMoney(sent, from.currency)} → </span>
                  )}
                  {fmtMoney(t.received, to.currency)}
                </span>
              </div>
              {t.note && <div className="flow-note">{t.note}</div>}
              {from && from.currency !== to.currency && <Rate from={sent} to={t.received} />}
            </li>
          );
        })}
      </ol>

      <div className="wallets">
        {summaries.map(({ wallet, inflow, outflow, spent, balance }) =>
          wallet.kind === 'card' ? (
            <div key={wallet.id} className="wallet">
              <div className="wallet-name">{wallet.name}</div>
              <div className="wallet-balance num">{fmtMoney(spent, wallet.currency)}</div>
              <div className="wallet-sub">利用額（円換算）</div>
            </div>
          ) : (
            <div key={wallet.id} className="wallet">
              <div className="wallet-name">{wallet.name}</div>
              <div className="wallet-balance num">{fmtMoney(balance, wallet.currency)}</div>
              <div className="wallet-sub">残高</div>
              <div
                className="meter"
                role="img"
                aria-label={`入金 ${fmtMoney(inflow, wallet.currency)} のうち 移動 ${fmtMoney(outflow, wallet.currency)}、支払い ${fmtMoney(spent, wallet.currency)}`}
              >
                <span className="meter-out" style={{ width: `${pct(outflow, inflow)}%` }} />
                <span className="meter-spent" style={{ width: `${pct(spent, inflow)}%` }} />
              </div>
              <dl className="wallet-lines num">
                <dt>入金</dt>
                <dd>{fmtMoney(inflow, wallet.currency)}</dd>
                {outflow > 0 && (
                  <>
                    <dt>
                      <span className="dot meter-out" />
                      移動
                    </dt>
                    <dd>−{fmtMoney(outflow, wallet.currency)}</dd>
                  </>
                )}
                <dt>
                  <span className="dot meter-spent" />
                  支払い
                </dt>
                <dd>−{fmtMoney(spent, wallet.currency)}</dd>
              </dl>
              {balance < 0 && <p className="warn">⚠ 残高がマイナス：チャージか支払い手段の記録漏れ？</p>}
            </div>
          ),
        )}
      </div>
    </div>
  );
}

const pct = (v: number, total: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);

function Rate({ from, to }: { from: number; to: number }) {
  return <div className="flow-note muted num">レート ¥1 = ₩{(to / from).toFixed(2)}（₩100 = ¥{((from / to) * 100).toFixed(2)}）</div>;
}
