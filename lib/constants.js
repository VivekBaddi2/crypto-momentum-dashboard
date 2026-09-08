// -----------------------------------------------------------------------------
// Central config. Everything here is free: Binance's public market-data
// endpoints require NO API key for klines, tickers, or WebSocket streams.
// -----------------------------------------------------------------------------

// Top liquid USDT pairs. Trim/extend this list freely — everything downstream
// (REST init, WS subscriptions, table rows) derives from it.
export const TRACKED_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "BNBUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "AVAXUSDT",
  "DOGEUSDT",
  "DOTUSDT",
  "LINKUSDT",
  "MATICUSDT",
  "LTCUSDT",
  "TRXUSDT",
  "NEARUSDT",
  "ATOMUSDT",
  "OPUSDT",
  "ARBUSDT",
  "SUIUSDT",
  "APTUSDT",
  "INJUSDT",
];

// Kline interval used for the whole strategy engine. Binance supports
// 1m/3m/5m/15m/30m/1h/... — 15m is a good momentum/breakout timeframe.
export const KLINE_INTERVAL = "15m";

// How many closed candles to keep in memory per symbol. Needs to comfortably
// exceed the longest indicator lookback (20-period Donchian / volume SMA,
// 21-period EMA) plus headroom for RSI smoothing.
export const CANDLE_BUFFER_SIZE = 200;

// Indicator lookback periods (kept together so the engine and UI agree).
export const PERIODS = {
  DONCHIAN: 20,
  VOLUME_SMA: 20,
  RSI: 14,
  EMA_FAST: 9,
  EMA_SLOW: 21,
};

// Signal thresholds.
export const VOLUME_SPIKE_MULTIPLIER = 1.5;
export const RSI_BUY_RANGE = [50, 70];
export const RSI_SELL_RANGE = [30, 50];
// A pair counts as "FORMING" when price is within this % of a Donchian
// boundary but full confirmation hasn't triggered yet.
export const FORMING_PROXIMITY_PCT = 0.35;

export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream";
