"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, CrosshairMode } from "lightweight-charts";
import { PERIODS } from "@/lib/constants";

/** Builds a rolling VWAP series (resets every UTC day) for chart overlay. */
function buildVwapSeries(candles) {
  const out = [];
  let cumPV = 0;
  let cumVol = 0;
  let currentDay = null;

  for (const c of candles) {
    const day = new Date(c.closeTime).toISOString().slice(0, 10);
    if (day !== currentDay) {
      currentDay = day;
      cumPV = 0;
      cumVol = 0;
    }
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumPV += typicalPrice * c.volume;
    cumVol += c.volume;
    out.push({
      time: Math.floor(c.closeTime / 1000),
      value: cumVol > 0 ? cumPV / cumVol : null,
    });
  }
  return out.filter((p) => p.value != null);
}

/** Builds rolling Donchian upper/lower series (look-ahead safe, period=20). */
function buildDonchianSeries(candles, period) {
  const upper = [];
  const lower = [];
  for (let i = period; i < candles.length; i++) {
    const window = candles.slice(i - period, i); // preceding `period` candles
    const highs = window.map((c) => c.high);
    const lows = window.map((c) => c.low);
    const time = Math.floor(candles[i].closeTime / 1000);
    upper.push({ time, value: Math.max(...highs) });
    lower.push({ time, value: Math.min(...lows) });
  }
  return { upper, lower };
}

export default function PairChart({ symbol, candles }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef({});

  // Create the chart once per mount.
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#A6AEBB",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1B212B" },
        horzLines: { color: "#1B212B" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#1B212B" },
      timeScale: { borderColor: "#1B212B", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#3DD9A3",
      downColor: "#F0654A",
      borderVisible: false,
      wickUpColor: "#3DD9A3",
      wickDownColor: "#F0654A",
    });

    const vwapSeries = chart.addLineSeries({
      color: "#D4A24C",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const upperSeries = chart.addLineSeries({
      color: "rgba(166, 174, 187, 0.45)",
      lineWidth: 1,
      lineStyle: 2, // dashed
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const lowerSeries = chart.addLineSeries({
      color: "rgba(166, 174, 187, 0.45)",
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#2A3140",
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });

    chartRef.current = chart;
    seriesRef.current = { candleSeries, vwapSeries, upperSeries, lowerSeries, volumeSeries };

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Push data whenever the candle buffer for the selected symbol changes.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series.candleSeries || !candles || candles.length === 0) return;

    const candleData = candles.map((c) => ({
      time: Math.floor(c.closeTime / 1000),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    const volumeData = candles.map((c) => ({
      time: Math.floor(c.closeTime / 1000),
      value: c.volume,
      color: c.close >= c.open ? "rgba(61, 217, 163, 0.35)" : "rgba(240, 101, 74, 0.35)",
    }));

    series.candleSeries.setData(candleData);
    series.volumeSeries.setData(volumeData);
    series.vwapSeries.setData(buildVwapSeries(candles));

    const { upper, lower } = buildDonchianSeries(candles, PERIODS.DONCHIAN);
    series.upperSeries.setData(upper);
    series.lowerSeries.setData(lower);

    chartRef.current?.timeScale().fitContent();
  }, [candles, symbol]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-base-700 px-4 py-3">
        <div>
          <h3 className="font-mono text-sm font-semibold text-ink-100">
            {symbol.replace("USDT", "")}/USDT
          </h3>
          <p className="text-[11px] text-ink-500">15m candles · VWAP · Donchian(20) · Volume</p>
        </div>
        <Legend />
      </div>
      <div ref={containerRef} className="min-h-[360px] flex-1" />
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 text-[11px] text-ink-500 sm:flex">
      <LegendItem color="#D4A24C" label="VWAP" />
      <LegendItem color="#A6AEBB" label="Donchian" dashed />
    </div>
  );
}

function LegendItem({ color, label, dashed }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-0.5 w-3"
        style={{
          backgroundColor: dashed ? "transparent" : color,
          borderTop: dashed ? `1.5px dashed ${color}` : "none",
        }}
      />
      {label}
    </span>
  );
}
