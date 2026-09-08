import "dotenv/config";
import WebSocket from "ws";
import { DemoAccount } from "../lib/account.js";
import {
  CANDLE_BUFFER_SIZE,
  KLINE_INTERVAL,
  PERIODS,
  WORKER_ACCOUNT_ID,
} from "../lib/constants.js";
import { fetchAllInitialCandles, fetchTradableUsdtPairs } from "../lib/binanceRest.js";
import { BinanceStreamManager } from "../lib/binanceSocket.js";
import { ALLOWED_BASE_ASSETS } from "../lib/coinAllowlist.js";
import { computeIndicatorSnapshot } from "../lib/indicators.js";
import { evaluateSignal, computeTradePlan, SIGNAL } from "../lib/signalEngine.js";
import {
  ensureIndexes,
  loadAccount,
  loadPairCatalog,
  persistSignal,
  persistTrade,
  savePairCatalog,
} from "../lib/db/persistence.js";

const account = new DemoAccount();
const candleBuffers = {};
const lastSignals = {};
const tickerCache = {};
const managers = [];

async function getPairs() {
  const cached = await loadPairCatalog();
  const cacheAge = cached?.updatedAt ? Date.now() - new Date(cached.updatedAt).getTime() : Infinity;
  if (cached?.source === "user-allowlist-v1" && cached?.pairs?.length && cacheAge < 6 * 60 * 60 * 1000) {
    return cached.pairs.map((pair) => pair.symbol);
  }

  const binancePairs = await fetchTradableUsdtPairs();
  const pairs = binancePairs
    .filter(({ baseAsset }) => ALLOWED_BASE_ASSETS.includes(baseAsset.toUpperCase()))
    .map(({ symbol, baseAsset }) => ({ symbol, baseAsset }));
  await savePairCatalog({ pairs, source: "user-allowlist-v1" });
  return pairs.map((pair) => pair.symbol);
}

async function persistTradeState(trade = null) {
  await persistTrade({
    accountId: WORKER_ACCOUNT_ID,
    trade,
    account: account.getAccountSummary(),
  });
}

async function processCandle(symbol, candle) {
  const buffer = candleBuffers[symbol] || [];
  const last = buffer[buffer.length - 1];
  if (last?.openTime === candle.openTime) buffer[buffer.length - 1] = candle;
  else {
    buffer.push(candle);
    if (buffer.length > CANDLE_BUFFER_SIZE) buffer.shift();
  }
  candleBuffers[symbol] = buffer;

  if (!candle.isFinal) return;
  const snapshot = computeIndicatorSnapshot(buffer, PERIODS);
  const { signal, reasons } = evaluateSignal(snapshot);
  const tradePlan = computeTradePlan(snapshot, signal);
  const previous = lastSignals[symbol];
  lastSignals[symbol] = signal;
  const price = tickerCache[symbol]?.lastPrice ?? snapshot.currentPrice;

  if ((signal === SIGNAL.BUY || signal === SIGNAL.SELL) && previous !== signal) {
    await persistSignal({
      accountId: WORKER_ACCOUNT_ID,
      symbol,
      interval: KLINE_INTERVAL,
      candle,
      indicators: snapshot,
      signal,
      reasons,
      tradePlan,
      price,
      occurredAt: new Date(),
    });
    const trade = account.executeTrade(symbol, signal, tradePlan, price);
    if (trade) await persistTradeState(trade);
  }

  const closedTrade = account.updatePosition(symbol, price);
  if (closedTrade) await persistTradeState(closedTrade);
}

async function start() {
  await ensureIndexes();
  const savedAccount = await loadAccount(WORKER_ACCOUNT_ID);
  account.hydrate(savedAccount);
  const symbols = await getPairs();
  if (!symbols.length) throw new Error("No qualifying Binance pairs found");
  const candles = await fetchAllInitialCandles(symbols, KLINE_INTERVAL, CANDLE_BUFFER_SIZE);
  Object.assign(candleBuffers, candles);

  for (let index = 0; index < symbols.length; index += 100) {
    const manager = new BinanceStreamManager({
      symbols: symbols.slice(index, index + 100),
      interval: KLINE_INTERVAL,
      WebSocketImpl: WebSocket,
      onKline: (symbol, candle) => processCandle(symbol, candle).catch((error) => console.error("Candle processing failed", error)),
      onMiniTicker: (symbol, ticker) => { tickerCache[symbol] = ticker; },
      onStatusChange: (status) => console.log(`Worker stream ${index / 100 + 1}: ${status}`),
    });
    manager.connect();
    managers.push(manager);
  }
  console.log(`Worker monitoring ${symbols.length} Binance pairs`);
}

start().catch((error) => {
  console.error("Trading worker failed to start", error);
  process.exitCode = 1;
});

function shutdown() {
  managers.forEach((manager) => manager.close());
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);