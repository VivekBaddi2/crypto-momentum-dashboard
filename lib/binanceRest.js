import { BINANCE_REST_BASE } from "./constants";

/**
 * Maps a raw Binance kline array (as returned by /api/v3/klines) into the
 * candle object shape used throughout the app.
 * Raw shape: [ openTime, open, high, low, close, volume, closeTime, ... ]
 */
function mapRawKline(raw) {
  return {
    openTime: raw[0],
    open: parseFloat(raw[1]),
    high: parseFloat(raw[2]),
    low: parseFloat(raw[3]),
    close: parseFloat(raw[4]),
    volume: parseFloat(raw[5]),
    closeTime: raw[6],
    isFinal: raw[6] < Date.now(),
  };
}

/**
 * Fetches recent closed candles for a single symbol. This is the free,
 * no-key public endpoint — subject only to Binance's generous public IP
 * rate limits.
 *
 * GET https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=200
 */
export async function fetchKlines(symbol, interval, limit = 200) {
  const url = `${BINANCE_REST_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance REST error for ${symbol}: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  return raw.map(mapRawKline);
}

export async function fetchTradableUsdtPairs() {
  const res = await fetch(`${BINANCE_REST_BASE}/api/v3/exchangeInfo`);
  if (!res.ok) {
    throw new Error(`Binance exchange info error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return data.symbols
    .filter(
      (symbol) =>
        symbol.status === "TRADING" &&
        symbol.quoteAsset === "USDT" &&
        symbol.isSpotTradingAllowed
    )
    .map((symbol) => symbol.symbol)
    .sort();
}

/**
 * Bootstraps candle history for every tracked symbol in parallel, with
 * small built-in staggering to stay comfortably under Binance's public
 * REST weight limits (1200 weight/min; each klines call weighs ~2).
 */
export async function fetchAllInitialCandles(symbols, interval, limit) {
  const results = {};
  const BATCH_SIZE = 5;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (symbol) => {
        try {
          const candles = await fetchKlines(symbol, interval, limit);
          return [symbol, candles];
        } catch (err) {
          console.error(err);
          return [symbol, []];
        }
      })
    );
    for (const [symbol, candles] of batchResults) {
      results[symbol] = candles;
    }
  }

  return results;
}
