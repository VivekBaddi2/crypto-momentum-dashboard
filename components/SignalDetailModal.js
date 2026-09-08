"use client";

import { useEffect } from "react";
import { X, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown } from "lucide-react";
import SignalBadge from "./SignalBadge";

function formatPrice(price) {
  if (price == null) return "—";
  const decimals = price >= 100 ? 2 : price >= 1 ? 4 : 6;
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatTime(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function PlanRow({ label, value, valueClass = "text-ink-100" }) {
  return (
    <div className="flex items-center justify-between border-b border-base-800 py-2.5 last:border-b-0">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={`font-mono tabular text-sm font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}

function WinProbabilityBar({ value }) {
  const color = value >= 65 ? "bg-bull-500" : value >= 45 ? "bg-amber-500" : "bg-bear-500";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs text-ink-500">Win probability (heuristic)</span>
        <span className="font-mono text-sm font-semibold text-ink-100">{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-800">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/**
 * detail shape (works for both a live table row and a historical alert):
 * {
 *   symbol, signal, price, rsi, vwap, volumeRatio, reasons, tradePlan,
 *   timestamp, isLive
 * }
 */
export default function SignalDetailModal({ detail, onClose }) {
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!detail) return null;

  const { symbol, signal, price, rsi, vwap, volumeRatio, reasons, tradePlan, timestamp, isLive } =
    detail;
  const isLong = tradePlan?.direction === "LONG";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-xl border border-base-700 bg-base-900 shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-base-700 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-base font-semibold text-ink-100">
                {symbol.replace("USDT", "")}/USDT
              </h2>
              <SignalBadge signal={signal} size="sm" />
            </div>
            <p className="mt-1 text-xs text-ink-500">
              {isLive ? "Live snapshot" : "Signal triggered"} · {formatTime(timestamp)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-500 transition-colors hover:bg-base-800 hover:text-ink-100"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
          {/* Price context */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-base-800 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-500">Price</p>
              <p className="font-mono tabular text-sm font-semibold text-ink-100">
                ${formatPrice(price)}
              </p>
            </div>
            <div className="rounded-lg bg-base-800 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-500">RSI (14)</p>
              <p className="font-mono tabular text-sm font-semibold text-ink-100">
                {rsi != null ? rsi.toFixed(1) : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-base-800 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-500">Vol x SMA20</p>
              <p className="font-mono tabular text-sm font-semibold text-ink-100">
                {volumeRatio != null ? `${volumeRatio.toFixed(2)}x` : "—"}
              </p>
            </div>
          </div>

          {/* Trade plan */}
          {tradePlan ? (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                {isLong ? (
                  <TrendingUp size={15} className="text-bull-400" />
                ) : (
                  <TrendingDown size={15} className="text-bear-400" />
                )}
                <h3 className="font-display text-sm font-semibold text-ink-100">
                  {isLong ? "Long setup" : "Short setup"}
                </h3>
                {tradePlan.isPreview && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-400 ring-1 ring-inset ring-amber-500/30">
                    PREVIEW · UNCONFIRMED
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-base-700 bg-base-800/50 px-3">
                <PlanRow label="Entry" value={`$${formatPrice(tradePlan.entry)}`} />
                <PlanRow
                  label="Stop-loss"
                  value={`$${formatPrice(tradePlan.stopLoss)}`}
                  valueClass="text-bear-400"
                />
                <PlanRow
                  label="Take-profit / exit target"
                  value={`$${formatPrice(tradePlan.takeProfit)}`}
                  valueClass="text-bull-400"
                />
                <PlanRow
                  label="Risk : Reward"
                  value={
                    tradePlan.riskRewardRatio != null
                      ? `1 : ${tradePlan.riskRewardRatio.toFixed(2)}`
                      : "—"
                  }
                />
              </div>

              <div className="mt-3 rounded-lg border border-base-700 bg-base-800/50 px-3 py-3">
                <WinProbabilityBar value={tradePlan.winProbability} />
              </div>

              <p className="mt-2 text-[11px] leading-snug text-ink-500">
                Stop-loss is the opposite Donchian channel boundary (structural
                breakout invalidation). Take-profit projects the channel's own
                width from entry (measured-move technique). Win probability is
                a heuristic confluence score from volume, RSI positioning,
                trend spread and VWAP distance — not a statistical guarantee
                or financial advice.
              </p>
            </div>
          ) : (
            <div className="mb-4 rounded-lg border border-base-700 bg-base-800/50 px-3 py-4 text-center">
              <p className="text-sm text-ink-300">No active trade setup</p>
              <p className="mt-1 text-xs text-ink-500">
                Conditions aren&apos;t aligned for a breakout right now.
              </p>
            </div>
          )}

          {/* Confluence reasons */}
          <div>
            <h3 className="mb-2 font-display text-sm font-semibold text-ink-100">
              Confluence factors
            </h3>
            <ul className="space-y-1.5">
              {reasons?.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-ink-300">
                  {signal === "SELL" ? (
                    <ArrowDownRight size={13} className="mt-0.5 shrink-0 text-bear-400" />
                  ) : (
                    <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-bull-400" />
                  )}
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}