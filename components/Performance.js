"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BriefcaseBusiness,
  CircleDollarSign,
  Percent,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCryptoData } from "@/hooks/useCryptoData";

const money = (value) => `₹${Math.abs(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const price = (value) => value == null ? "—" : `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
const time = (value) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function Performance() {
  const { account, connectionStatus } = useCryptoData();
  const trades = account.allTrades || [];
  const positions = account.positions || [];

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 pb-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-base-700 py-5">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Back to terminal" className="rounded-lg border border-base-700 p-2 text-ink-300 hover:border-amber-500/50 hover:text-amber-400">
            <ArrowLeft size={17} />
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-inset ring-amber-500/30">
            <BarChart3 size={18} className="text-amber-400" />
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-400">Account intelligence</p>
            <h1 className="font-display text-xl font-semibold text-ink-100">Performance report</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ink-500">
          <span className={`h-2 w-2 rounded-full ${connectionStatus === "connected" ? "bg-bull-400" : "bg-amber-400"}`} />
          LIVE ACCOUNT DATA
        </div>
      </header>

      <section className="grid gap-3 py-6 sm:grid-cols-2 lg:grid-cols-5">
        <Metric icon={CircleDollarSign} label="Account balance" value={money(account.balance)} detail={`${account.totalReturn.toFixed(2)}% total return`} tone="bull" />
        <Metric icon={Percent} label="Win rate" value={`${account.winRate}%`} detail={`${account.winningTrades} wins / ${account.losingTrades} losses`} tone="amber" />
        <Metric icon={TrendingUp} label="Gross profit" value={`+${money(account.totalProfit)}`} detail="Winning trades" tone="bull" />
        <Metric icon={TrendingDown} label="Gross loss" value={`-${money(account.totalLoss)}`} detail="Losing trades" tone="bear" />
        <Metric icon={BriefcaseBusiness} label="Total trades" value={account.totalTrades} detail={`${account.openPositions.length} currently open`} tone="ink" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <Panel title="Equity overview" eyebrow="Balance trajectory">
          <EquityChart account={account} />
        </Panel>
        <Panel title="Outcome mix" eyebrow="Closed trade distribution">
          <OutcomeChart account={account} />
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Legend label="Winning" value={account.winningTrades} tone="bull" />
            <Legend label="Losing" value={account.losingTrades} tone="bear" />
          </div>
        </Panel>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-base-700 bg-base-900 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-700 px-4 py-4 sm:px-5">
          <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">Execution log</p><h2 className="mt-1 font-display text-base font-semibold text-ink-100">Trades taken</h2></div>
          <span className="rounded-full bg-base-800 px-2.5 py-1 font-mono text-[11px] text-ink-500">{trades.length} closed</span>
        </div>
        <TradeTable trades={trades} positions={positions} />
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  const colors = { bull: "text-bull-400", bear: "text-bear-400", amber: "text-amber-400", ink: "text-ink-100" };
  return <div className="rounded-xl border border-base-700 bg-base-900 p-4 shadow-panel"><Icon size={17} className={colors[tone]} /><p className="mt-4 text-xs text-ink-500">{label}</p><p className={`mt-1 font-mono text-xl font-semibold tabular ${colors[tone]}`}>{value}</p><p className="mt-1 text-[11px] text-ink-500">{detail}</p></div>;
}

function Panel({ title, eyebrow, children }) { return <section className="rounded-xl border border-base-700 bg-base-900 p-4 shadow-panel sm:p-5"><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-400">{eyebrow}</p><h2 className="mt-1 font-display text-base font-semibold text-ink-100">{title}</h2>{children}</section>; }

function EquityChart({ account }) {
  const trades = [...(account.allTrades || [])].reverse();
  const values = [account.initialBalance, ...trades.reduce((list, trade) => [...list, list[list.length - 1] + trade.realizedPnl], [])];
  const min = Math.min(...values, account.initialBalance); const max = Math.max(...values, account.initialBalance); const range = max - min || 1;
  const points = values.map((value, index) => `${(index / Math.max(values.length - 1, 1)) * 100},${92 - ((value - min) / range) * 76}`).join(" ");
  return <div className="mt-5"><div className="flex items-end justify-between"><div><span className="font-mono text-2xl font-semibold tabular text-ink-100">{money(account.balance)}</span><span className={`ml-2 font-mono text-xs ${account.totalReturn >= 0 ? "text-bull-400" : "text-bear-400"}`}>{account.totalReturn >= 0 ? "+" : ""}{account.totalReturn.toFixed(2)}%</span></div><span className="font-mono text-[10px] text-ink-500">START {money(account.initialBalance)}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-44 w-full overflow-visible"><defs><linearGradient id="equity-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#4FE3B5" stopOpacity=".28" /><stop offset="1" stopColor="#4FE3B5" stopOpacity="0" /></linearGradient></defs><path d={`M ${points} L 100,100 L 0,100 Z`} fill="url(#equity-fill)" /><polyline points={points} fill="none" stroke="#4FE3B5" strokeWidth="1.8" vectorEffect="non-scaling-stroke" /></svg><div className="flex justify-between border-t border-base-700 pt-2 font-mono text-[10px] text-ink-500"><span>Initial deposit</span><span>{account.totalTrades ? "Latest close" : "Waiting for first close"}</span></div></div>;
}

function OutcomeChart({ account }) { const total = account.totalTrades || 1; const win = (account.winningTrades / total) * 100; return <div className="relative mx-auto mt-6 flex h-44 w-44 items-center justify-center rounded-full" style={{ background: `conic-gradient(#4FE3B5 0 ${win}%, #F0654A ${win}% 100%)` }}><div className="flex h-32 w-32 flex-col items-center justify-center rounded-full bg-base-900"><span className="font-mono text-2xl font-semibold text-ink-100">{account.totalTrades}</span><span className="text-[11px] text-ink-500">closed trades</span></div></div>; }
function Legend({ label, value, tone }) { return <div className="flex items-center justify-between rounded-lg bg-base-800 px-3 py-2"><span className="flex items-center gap-2 text-xs text-ink-300"><span className={`h-2 w-2 rounded-full ${tone === "bull" ? "bg-bull-400" : "bg-bear-400"}`} />{label}</span><span className="font-mono text-sm tabular text-ink-100">{value}</span></div>; }

function TradeTable({ trades, positions }) {
  if (!trades.length && !positions.length) return <div className="px-5 py-12 text-center text-sm text-ink-500">No completed trades yet. Confirmed signal executions will appear here.</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-base-800 font-mono text-[10px] uppercase tracking-wider text-ink-500"><tr><th className="px-5 py-3">Pair / status</th><th className="px-5 py-3">Direction</th><th className="px-5 py-3">Entry → exit</th><th className="px-5 py-3">Risk plan</th><th className="px-5 py-3">P&amp;L</th><th className="px-5 py-3">Timing</th></tr></thead><tbody>{[...positions.map((trade) => ({ ...trade, status: "open" })), ...trades].map((trade) => <TradeRow key={`${trade.id || trade.symbol}-${trade.entryTime}`} trade={trade} />)}</tbody></table></div>;
}

function TradeRow({ trade }) { const isLong = trade.direction === "LONG"; const isOpen = trade.status === "open"; const pnl = isOpen ? trade.unrealizedPnl : trade.realizedPnl; return <tr className="border-t border-base-800 text-xs text-ink-300"><td className="px-5 py-4"><div className="flex items-center gap-2 font-mono font-semibold text-ink-100">{trade.symbol.replace("USDT", "")} {isLong ? <ArrowUpRight size={13} className="text-bull-400" /> : <ArrowDownRight size={13} className="text-bear-400" />}</div><span className={`font-mono text-[10px] uppercase ${isOpen ? "text-amber-400" : "text-ink-500"}`}>{isOpen ? "Open position" : `${trade.exitReason?.replace("_", " ") || "closed"}`}</span></td><td className={`px-5 py-4 font-mono text-xs ${isLong ? "text-bull-400" : "text-bear-400"}`}>{trade.direction}</td><td className="px-5 py-4 font-mono tabular">{price(trade.entryPrice)} <span className="text-ink-500">→</span> {price(isOpen ? trade.currentPrice : trade.exitPrice)}</td><td className="px-5 py-4 font-mono text-[11px] tabular text-ink-500">SL {price(trade.stopLoss)}<br />TP {price(trade.takeProfit)}</td><td className={`px-5 py-4 font-mono font-semibold tabular ${pnl >= 0 ? "text-bull-400" : "text-bear-400"}`}>{pnl >= 0 ? "+" : "-"}{money(pnl)}</td><td className="px-5 py-4 font-mono text-[11px] text-ink-500">{time(isOpen ? trade.entryTime : trade.exitTime)}{!isOpen && <><br />{Math.max(1, Math.round((trade.duration || 0) / 60000))} min held</>}</td></tr>; }