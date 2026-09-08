"use client";

import { useEffect, useRef, useState } from "react";
import SignalBadge from "./SignalBadge";

function formatPrice(price) {
  if (price == null) return "—";
  const decimals = price >= 100 ? 2 : price >= 1 ? 4 : 6;
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatCompactVolume(vol) {
  if (vol == null) return "—";
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

function RsiCell({ value }) {
  if (value == null) return <span className="text-ink-500">—</span>;
  const color =
    value >= 70 ? "text-bear-400" : value <= 30 ? "text-bull-400" : "text-ink-300";
  return <span className={`tabular ${color}`}>{value.toFixed(1)}</span>;
}

function TickerRow({ asset, isSelected, onSelect, onOpenDetail }) {
  const prevPriceRef = useRef(asset.price);
  const [flashClass, setFlashClass] = useState("");

  useEffect(() => {
    if (prevPriceRef.current != null && asset.price != null) {
      if (asset.price > prevPriceRef.current) setFlashClass("animate-flash-bull");
      else if (asset.price < prevPriceRef.current) setFlashClass("animate-flash-bear");
    }
    prevPriceRef.current = asset.price;
    const t = setTimeout(() => setFlashClass(""), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset.price]);

  const isPositive = (asset.changePct ?? 0) >= 0;

  return (
    <tr
      onClick={() => onSelect(asset.symbol)}
      className={`cursor-pointer border-b border-base-800 text-sm transition-colors hover:bg-base-800/60 ${flashClass} ${
        isSelected ? "bg-amber-500/[0.06]" : ""
      }`}
    >
      <td className="whitespace-nowrap px-4 py-3 font-mono font-medium text-ink-100">
        <div className="flex items-center gap-2">
          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
          {asset.symbol.replace("USDT", "")}
          <span className="text-ink-500">/USDT</span>
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular text-ink-100">
        ${formatPrice(asset.price)}
      </td>
      <td
        className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular ${
          isPositive ? "text-bull-400" : "text-bear-400"
        }`}
      >
        {asset.changePct == null
          ? "—"
          : `${isPositive ? "+" : ""}${asset.changePct.toFixed(2)}%`}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
        <RsiCell value={asset.rsi} />
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
        {asset.vwapPosition == null ? (
          <span className="text-ink-500">—</span>
        ) : (
          <span
            className={asset.vwapPosition === "above" ? "text-bull-400" : "text-bear-400"}
          >
            {asset.vwapPosition === "above" ? "Above VWAP" : "Below VWAP"}
          </span>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular text-ink-300">
        {asset.volumeRatio == null ? "—" : `${asset.volumeRatio.toFixed(2)}x`}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular text-ink-500">
        {formatCompactVolume(asset.volume24h)}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(asset);
          }}
          className="rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          title="View signal details"
        >
          <SignalBadge signal={asset.signal} size="sm" />
        </button>
      </td>
    </tr>
  );
}

const COLUMNS = [
  { key: "symbol", label: "Pair", align: "left" },
  { key: "price", label: "Price", align: "right" },
  { key: "changePct", label: "24h %", align: "right" },
  { key: "rsi", label: "RSI (14)", align: "right" },
  { key: "vwap", label: "VWAP", align: "right" },
  { key: "volumeRatio", label: "Vol x SMA20", align: "right" },
  { key: "volume24h", label: "24h Vol", align: "right" },
  { key: "signal", label: "Signal", align: "left" },
];

export default function TickerTable({
  assets,
  selectedSymbol,
  onSelectSymbol,
  onOpenDetail,
  isLoading,
}) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-ink-500 font-mono">
        Loading candle history from Binance…
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-1 text-sm text-ink-500">
        <p className="font-mono">No pairs match the current filter.</p>
        <p className="text-xs">Try clearing the search or switching signal type.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-base-700 text-left text-[11px] uppercase tracking-wider text-ink-500">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className={`whitespace-nowrap px-4 py-2.5 font-mono font-medium ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <TickerRow
              key={asset.symbol}
              asset={asset}
              isSelected={asset.symbol === selectedSymbol}
              onSelect={onSelectSymbol}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}