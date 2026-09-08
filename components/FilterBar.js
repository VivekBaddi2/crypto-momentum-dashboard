import { useState } from "react";
import { ArrowDownWideNarrow, Search } from "lucide-react";

const SIGNAL_FILTERS = ["ALL", "BUY", "SELL", "FORMING", "NEUTRAL"];
const SORT_OPTIONS = [
  { value: "volumeRatio", label: "Volume surge" },
  { value: "changePct", label: "24h change" },
  { value: "rsi", label: "RSI" },
  { value: "symbol", label: "Name" },
];

export default function FilterBar({
  activeFilter,
  onFilterChange,
  sortBy,
  onSortChange,
  searchQuery,
  onSearchChange,
  resultCount,
  availablePairs,
  trackedSymbols,
  onAddPair,
  onRemovePair,
}) {
  const [pairToAdd, setPairToAdd] = useState("");

  const addPair = () => {
    if (!pairToAdd) return;
    onAddPair(pairToAdd);
    setPairToAdd("");
  };

  return (
    <div className="flex flex-col gap-3 border-b border-base-700 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {SIGNAL_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-mono font-medium tracking-wide transition-colors ${
              activeFilter === f
                ? "bg-amber-500/15 text-amber-400 ring-1 ring-inset ring-amber-500/40"
                : "text-ink-500 hover:bg-base-800 hover:text-ink-300"
            }`}
          >
            {f}
          </button>
        ))}
        <span className="ml-2 text-xs text-ink-500 font-mono">{resultCount} pairs</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-md border border-base-700 bg-base-800 px-2 py-1.5">
          <input
            list="binance-pairs"
            value={pairToAdd}
            onChange={(e) => setPairToAdd(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && addPair()}
            placeholder="Add pair"
            className="w-24 bg-transparent text-xs text-ink-100 placeholder:text-ink-500 focus:outline-none"
            aria-label="Add Binance pair"
          />
          <button
            type="button"
            onClick={addPair}
            className="font-mono text-[10px] font-semibold text-amber-400 hover:text-amber-300"
          >
            ADD
          </button>
          <datalist id="binance-pairs">
            {availablePairs
              .filter((pair) => !trackedSymbols.includes(pair))
              .map((pair) => <option key={pair} value={pair} />)}
          </datalist>
        </div>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-500"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search pair…"
            className="w-36 rounded-md border border-base-700 bg-base-800 py-1.5 pl-8 pr-2 text-xs text-ink-100 placeholder:text-ink-500 focus:border-amber-500/50 focus:outline-none"
          />
        </div>

        <div className="relative flex items-center gap-1.5 rounded-md border border-base-700 bg-base-800 px-2.5 py-1.5">
          <ArrowDownWideNarrow size={13} className="text-ink-500" />
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
            className="bg-transparent text-xs text-ink-300 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-base-800">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {trackedSymbols.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-ink-500">
          <span>MONITORING:</span>
          {trackedSymbols.map((pair) => (
            <button
              key={pair}
              type="button"
              onClick={() => onRemovePair(pair)}
              title={`Stop monitoring ${pair}`}
              className="rounded bg-base-800 px-1.5 py-1 text-ink-300 hover:text-bear-400"
            >
              {pair.replace("USDT", "")} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
