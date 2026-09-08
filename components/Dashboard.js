"use client";

import { useMemo, useState } from "react";
import { Activity, BarChart3, Radio } from "lucide-react";
import Link from "next/link";
import { useCryptoData } from "@/hooks/useCryptoData";
import FilterBar from "./FilterBar";
import TickerTable from "./TickerTable";
import AlertFeed from "./AlertFeed";
import PairChart from "./PairChart";
import SignalDetailModal from "./SignalDetailModal";

const STATUS_CONFIG = {
  connected: { label: "LIVE", dot: "bg-bull-500", pulse: true },
  connecting: { label: "CONNECTING", dot: "bg-amber-500", pulse: true },
  reconnecting: { label: "RECONNECTING", dot: "bg-amber-500", pulse: true },
  disconnected: { label: "DISCONNECTED", dot: "bg-bear-500", pulse: false },
};

export default function Dashboard() {
  const { assets, getCandles, alerts, connectionStatus, isInitialLoading, account } =
    useCryptoData();

  const [signalFilter, setSignalFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("volumeRatio");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [detail, setDetail] = useState(null); // powers SignalDetailModal

  // From a live table row: {symbol, signal, price, rsi, vwap, volumeRatio,
  // reasons, tradePlan, updatedAt} -> normalize to the modal's shape.
  const openDetailFromAsset = (asset) => {
    setDetail({
      symbol: asset.symbol,
      signal: asset.signal,
      price: asset.price,
      rsi: asset.rsi,
      vwap: asset.vwap,
      volumeRatio: asset.volumeRatio,
      reasons: asset.reasons,
      tradePlan: asset.tradePlan,
      timestamp: asset.updatedAt,
      isLive: true,
    });
  };

  // From the alert feed: show the setup exactly as it looked at trigger
  // time, not the live-updating current state.
  const openDetailFromAlert = (alert) => {
    setDetail({
      symbol: alert.symbol,
      signal: alert.signal,
      price: alert.price,
      rsi: null,
      vwap: null,
      volumeRatio: null,
      reasons: alert.reasons,
      tradePlan: alert.tradePlan,
      timestamp: alert.timestamp,
      isLive: false,
    });
  };

  const filteredAssets = useMemo(() => {
    let list = [...assets];

    if (signalFilter !== "ALL") {
      list = list.filter((a) => a.signal === signalFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      list = list.filter((a) => a.symbol.includes(q));
    }

    list.sort((a, b) => {
      if (sortBy === "symbol") return a.symbol.localeCompare(b.symbol);
      const av = a[sortBy] ?? -Infinity;
      const bv = b[sortBy] ?? -Infinity;
      return bv - av; // descending for numeric metrics
    });

    return list;
  }, [assets, signalFilter, searchQuery, sortBy]);

  const counts = useMemo(() => {
    const c = { BUY: 0, SELL: 0, FORMING: 0, NEUTRAL: 0 };
    for (const a of assets) c[a.signal] = (c[a.signal] || 0) + 1;
    return c;
  }, [assets]);

  const activeSymbol = selectedSymbol || filteredAssets[0]?.symbol || null;
  const status = STATUS_CONFIG[connectionStatus] || STATUS_CONFIG.connecting;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col">
      {/* Header */}
      <header className="flex flex-col gap-3 border-b border-base-700 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 ring-1 ring-inset ring-amber-500/30">
            <Activity size={18} className="text-amber-400" />
          </div>
          <div>
            <h1 className="font-display text-lg font-semibold leading-tight text-ink-100">
              Momentum Terminal
            </h1>
            <p className="text-xs text-ink-500">Live breakout & volume-surge tracker</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <SummaryStat label="BUY" value={counts.BUY} tone="text-bull-400" />
          <SummaryStat label="SELL" value={counts.SELL} tone="text-bear-400" />
          <SummaryStat label="FORMING" value={counts.FORMING} tone="text-amber-400" />
          <Link
            href="/performance"
            className="hidden items-center gap-2 rounded-lg border border-base-700 bg-base-900 px-3 py-2 font-mono text-[11px] font-medium tracking-wide text-ink-300 transition-colors hover:border-amber-500/50 hover:text-amber-400 sm:flex"
          >
            <BarChart3 size={14} />
            PERFORMANCE
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-base-700 bg-base-900 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              {status.pulse && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${status.dot}`}
                />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${status.dot}`} />
            </span>
            <span className="font-mono text-[11px] font-medium tracking-wide text-ink-300">
              {status.label}
            </span>
            <Radio size={12} className="text-ink-500" />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        {/* Main column */}
        <main className="flex flex-1 flex-col gap-4 min-w-0">
          {/* Chart panel */}
          <section className="overflow-hidden rounded-xl border border-base-700 bg-base-900 shadow-panel">
            {activeSymbol ? (
              <PairChart symbol={activeSymbol} candles={getCandles(activeSymbol)} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-ink-500">
                Select a pair from the table to view its chart
              </div>
            )}
          </section>

          {/* Table panel */}
          <section className="flex-1 overflow-hidden rounded-xl border border-base-700 bg-base-900 shadow-panel">
            <FilterBar
              activeFilter={signalFilter}
              onFilterChange={setSignalFilter}
              sortBy={sortBy}
              onSortChange={setSortBy}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultCount={filteredAssets.length}
            />
            <TickerTable
              assets={filteredAssets}
              selectedSymbol={activeSymbol}
              onSelectSymbol={setSelectedSymbol}
              onOpenDetail={openDetailFromAsset}
              isLoading={isInitialLoading}
            />
          </section>
        </main>

        {/* Alert feed sidebar */}
        <aside className="w-full shrink-0 overflow-hidden rounded-xl border border-base-700 bg-base-900 shadow-panel lg:w-80">
          <div className="h-full max-h-[480px] lg:max-h-none">
            <AlertFeed alerts={alerts} onOpenDetail={openDetailFromAlert} />
          </div>
        </aside>
      </div>

      <footer className="border-t border-base-700 px-4 py-3 text-center text-[11px] text-ink-500 sm:px-6">
        Data via Binance public REST &amp; WebSocket API — no key required. For
        informational purposes only, not financial advice.
      </footer>

      <SignalDetailModal detail={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

function SummaryStat({ label, value, tone }) {
  return (
    <div className="flex items-baseline gap-1.5 font-mono">
      <span className={`text-base font-semibold tabular ${tone}`}>{value}</span>
      <span className="text-[11px] text-ink-500">{label}</span>
    </div>
  );
}
