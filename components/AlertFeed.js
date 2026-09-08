"use client";

import { Bell, ArrowUpRight, ArrowDownRight } from "lucide-react";

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function AlertItem({ alert, onOpenDetail }) {
  const isBuy = alert.signal === "BUY";
  return (
    <li
      onClick={() => onOpenDetail(alert)}
      className="animate-slide-in cursor-pointer border-b border-base-800 px-4 py-3 transition-colors hover:bg-base-800/60"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isBuy ? (
            <ArrowUpRight size={13} className="text-bull-400" strokeWidth={2.5} />
          ) : (
            <ArrowDownRight size={13} className="text-bear-400" strokeWidth={2.5} />
          )}
          <span className="font-mono text-sm font-semibold text-ink-100">
            {alert.symbol.replace("USDT", "")}
          </span>
          <span
            className={`font-mono text-xs font-semibold ${
              isBuy ? "text-bull-400" : "text-bear-400"
            }`}
          >
            {alert.signal}
          </span>
        </div>
        <span className="font-mono text-[11px] text-ink-500">
          {formatTime(alert.timestamp)}
        </span>
      </div>
      <p className="mt-1 font-mono text-xs tabular text-ink-300">
        @ ${alert.price?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {alert.reasons.slice(0, 3).map((reason, i) => (
          <li key={i} className="text-[11px] leading-snug text-ink-500">
            · {reason}
          </li>
        ))}
      </ul>
    </li>
  );
}

export default function AlertFeed({ alerts, onOpenDetail }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-base-700 px-4 py-3">
        <Bell size={15} className="text-amber-400" />
        <h2 className="font-display text-sm font-semibold text-ink-100">
          Live Signal Feed
        </h2>
        <span className="ml-auto rounded-full bg-base-800 px-2 py-0.5 font-mono text-[11px] text-ink-500">
          {alerts.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-4 py-10 text-center">
            <p className="text-sm text-ink-500">No signals yet</p>
            <p className="text-xs text-ink-500/70">
              Confirmed BUY / SELL breakouts will appear here the moment they trigger.
            </p>
          </div>
        ) : (
          <ul>
            {alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} onOpenDetail={onOpenDetail} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}