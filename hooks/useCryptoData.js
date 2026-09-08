"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { fetchAllInitialCandles, fetchTradableUsdtPairs } from "@/lib/binanceRest";
import { BinanceStreamManager } from "@/lib/binanceSocket";
import { computeIndicatorSnapshot } from "@/lib/indicators";
import { evaluateSignal, computeTradePlan, SIGNAL } from "@/lib/signalEngine";
import { demoAccount } from "@/lib/account";
import {
  TRACKED_SYMBOLS,
  KLINE_INTERVAL,
  CANDLE_BUFFER_SIZE,
  PERIODS,
} from "@/lib/constants";

const MAX_ALERTS = 60;

function persistToDatabase(payload) {
  fetch("/api/persistence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      console.log(`Database persistence succeeded: ${payload.type}`);
    })
    .catch((error) => {
      console.error(`Database persistence failed: ${payload.type}`, error);
    });
}

/**
 * The single source of truth for the dashboard. Responsibilities:
 *  1. REST-bootstraps candle history for every tracked symbol.
 *  2. Opens one combined WebSocket for live klines + 24h mini-ticker data.
 *  3. Recomputes indicators/signals whenever a candle updates.
 *  4. Detects signal *transitions* (e.g. NEUTRAL -> BUY) and appends them
 *     to a rolling, time-stamped alert feed.
 *
 * Candle buffers and previous-signal tracking live in refs (not state) so
 * every tick doesn't force a full re-render — only the derived, UI-facing
 * `assets` snapshot is pushed into React state, and that's throttled.
 */
export function useCryptoData() {
  const [assets, setAssets] = useState({}); // symbol -> full row data
  const [alerts, setAlerts] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [availablePairs, setAvailablePairs] = useState(TRACKED_SYMBOLS);
  const [trackedSymbols, setTrackedSymbols] = useState(TRACKED_SYMBOLS);

  const candleBuffers = useRef({}); // symbol -> candle[]
  const lastSignals = useRef({}); // symbol -> last SIGNAL for transition detection
  const tickerCache = useRef({}); // symbol -> latest miniTicker payload
  const streamManagerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const dirtySymbols = useRef(new Set());

  const pushAlert = useCallback((symbol, signal, reasons, price, tradePlan) => {
    setAlerts((prev) => {
      const next = [
        {
          id: `${symbol}-${Date.now()}`,
          symbol,
          signal,
          reasons,
          price,
          tradePlan, // snapshot of entry/stop/target/win-prob AS OF the trigger
          timestamp: Date.now(),
        },
        ...prev,
      ];
      return next.slice(0, MAX_ALERTS);
    });
  }, []);

  const recomputeSymbol = useCallback(
    (symbol) => {
      const candles = candleBuffers.current[symbol];
      if (!candles || candles.length === 0) return null;

      const snapshot = computeIndicatorSnapshot(candles, PERIODS);
      const { signal, reasons } = evaluateSignal(snapshot);
      const tradePlan = computeTradePlan(snapshot, signal);
      const ticker = tickerCache.current[symbol] || {};
      const latestCandle = candles[candles.length - 1];

      const changePct =
        ticker.open24h && ticker.lastPrice
          ? ((ticker.lastPrice - ticker.open24h) / ticker.open24h) * 100
          : null;

      const row = {
        symbol,
        price: ticker.lastPrice ?? snapshot.currentPrice,
        changePct,
        volume24h: ticker.volume24h ?? null,
        rsi: snapshot.rsi,
        vwap: snapshot.vwap,
        vwapPosition:
          snapshot.vwap != null && snapshot.currentPrice != null
            ? snapshot.currentPrice >= snapshot.vwap
              ? "above"
              : "below"
            : null,
        volumeRatio: snapshot.volumeRatio,
        emaFast: snapshot.emaFast,
        emaSlow: snapshot.emaSlow,
        donchianUpper: snapshot.donchianUpper,
        donchianLower: snapshot.donchianLower,
        signal,
        reasons,
        tradePlan,
        updatedAt: latestCandle?.closeTime ?? Date.now(),
      };

      // Fire an alert only on a genuine transition INTO BUY or SELL, not on
      // every tick while a signal stays active (that would spam the feed).
      const prevSignal = lastSignals.current[symbol];
      const isSignalTransition =
        (signal === SIGNAL.BUY || signal === SIGNAL.SELL) &&
        prevSignal !== signal &&
        latestCandle?.isFinal;

      if (isSignalTransition) {
        pushAlert(symbol, signal, reasons, row.price, tradePlan);
        persistToDatabase({
          type: "signal",
          symbol,
          interval: KLINE_INTERVAL,
          candle: latestCandle,
          indicators: snapshot,
          signal,
          reasons,
          tradePlan,
          price: row.price,
          occurredAt: new Date(),
        });
        // Execute trade on signal transition
        const openedTrade = demoAccount.executeTrade(symbol, signal, tradePlan, row.price);
        if (openedTrade) {
          persistToDatabase({
            type: "trade",
            trade: openedTrade,
            account: demoAccount.getAccountSummary(),
          });
        }
      }
      if (latestCandle?.isFinal) lastSignals.current[symbol] = signal;

      // Update position for this symbol to check SL/TP
      const closedTrade = demoAccount.updatePosition(symbol, row.price);
      if (closedTrade) {
        persistToDatabase({
          type: "trade",
          trade: closedTrade,
          account: demoAccount.getAccountSummary(),
        });
        // Optionally, we could push a closure alert here
        // pushAlert(symbol, 'CLOSED', [`Position closed: ${closedTrade.exitReason}`], closedTrade.exitPrice, {});
      }

      return row;
    },
    [pushAlert]
  );

  // Batch UI state updates on a short interval instead of on every single
  // WS message — keeps 20 symbols worth of tick data from thrashing React.
  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const updates = {};
      for (const symbol of dirtySymbols.current) {
        const row = recomputeSymbol(symbol);
        if (row) updates[symbol] = row;
      }
      dirtySymbols.current.clear();
      if (Object.keys(updates).length) {
        setAssets((prev) => ({ ...prev, ...updates }));
      }
    }, 400);
  }, [recomputeSymbol]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setIsInitialLoading(true);
      if (trackedSymbols.length === TRACKED_SYMBOLS.length) {
        try {
          const response = await fetch("/api/persistence");
          if (response.ok) {
            const { account } = await response.json();
            demoAccount.hydrate(account);
          }
        } catch (error) {
          console.error("Account hydration failed", error);
        }
        try {
          const pairs = await fetchTradableUsdtPairs();
          setAvailablePairs(pairs);
        } catch (error) {
          console.error("Pair catalog loading failed", error);
        }
      }
      const initial = await fetchAllInitialCandles(
        trackedSymbols,
        KLINE_INTERVAL,
        CANDLE_BUFFER_SIZE
      );
      if (cancelled) return;

      candleBuffers.current = initial;

      const seeded = {};
      for (const symbol of trackedSymbols) {
        const row = recomputeSymbol(symbol);
        if (row) seeded[symbol] = row;
      }
      setAssets(seeded);
      setIsInitialLoading(false);

      // Only start streaming live data once history is seeded, so the
      // first indicator readings aren't computed on a near-empty buffer.
      const manager = new BinanceStreamManager({
        symbols: trackedSymbols,
        interval: KLINE_INTERVAL,
        onStatusChange: setConnectionStatus,
        onKline: (symbol, candle) => {
          const buffer = candleBuffers.current[symbol] || [];
          const last = buffer[buffer.length - 1];

          if (last && last.openTime === candle.openTime) {
            // Same in-progress candle — replace it in place.
            buffer[buffer.length - 1] = candle;
          } else {
            buffer.push(candle);
            if (buffer.length > CANDLE_BUFFER_SIZE) buffer.shift();
          }
          candleBuffers.current[symbol] = buffer;
          dirtySymbols.current.add(symbol);
          scheduleFlush();
        },
        onMiniTicker: (symbol, ticker) => {
          tickerCache.current[symbol] = ticker;
          dirtySymbols.current.add(symbol);
          scheduleFlush();
        },
      });

      manager.connect();
      streamManagerRef.current = manager;
    }

    bootstrap();

    return () => {
      cancelled = true;
      streamManagerRef.current?.close();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    };
  }, [recomputeSymbol, scheduleFlush, trackedSymbols]);

  const assetList = useMemo(() => Object.values(assets), [assets]);
  const accountSummary = demoAccount.getAccountSummary();

  return {
    assets: assetList,
    getCandles: (symbol) => [...(candleBuffers.current[symbol] || [])],
    alerts,
    connectionStatus,
    isInitialLoading,
    account: accountSummary,
    availablePairs,
    trackedSymbols,
    addPair: (symbol) => {
      if (availablePairs.includes(symbol)) {
        setTrackedSymbols((current) => current.includes(symbol) ? current : [...current, symbol]);
      }
    },
    removePair: (symbol) => {
      if (trackedSymbols.length > 1) {
        setTrackedSymbols((current) => current.filter((item) => item !== symbol));
      }
    },
  };
}