// -----------------------------------------------------------------------------
// Pure, dependency-free technical indicator functions.
//
// Every function takes plain arrays/candle objects and returns numbers (or
// arrays of numbers) — no side effects, no external calls. This makes them
// trivially unit-testable and reusable from both the live hook and any
// backtest you might bolt on later.
//
// Candle shape used throughout the app:
// { openTime, open, high, low, close, volume, closeTime, isFinal }
// -----------------------------------------------------------------------------

/** Simple Moving Average over the last `period` values. */
export function sma(values, period) {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

/**
 * Exponential Moving Average series (returns an array the same length as
 * `values`, with `null` for indices before the EMA can be seeded).
 * Seeded with a simple average of the first `period` values, standard practice.
 */
export function emaSeries(values, period) {
  const out = new Array(values.length).fill(null);
  if (values.length < period) return out;

  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = seed;

  let prev = seed;
  for (let i = period; i < values.length; i++) {
    const next = values[i] * k + prev * (1 - k);
    out[i] = next;
    prev = next;
  }
  return out;
}

/** Convenience: just the latest EMA value, or null if not enough data. */
export function ema(values, period) {
  const series = emaSeries(values, period);
  return series[series.length - 1];
}

/**
 * Wilder's RSI (the standard 14-period RSI used by every charting platform).
 * Returns a value 0-100, or null if there isn't enough data yet.
 */
export function rsi(closes, period = 14) {
  if (closes.length < period + 1) return null;

  let gainSum = 0;
  let lossSum = 0;

  // Seed with a simple average over the first `period` changes.
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum -= change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  // Wilder smoothing for the remaining changes.
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/**
 * Intraday VWAP: cumulative (typical price * volume) / cumulative volume,
 * resetting at the start of each UTC day (the conventional VWAP session
 * boundary for 24/7 crypto markets).
 */
export function vwap(candles) {
  if (!candles.length) return null;

  const lastCandle = candles[candles.length - 1];
  const dayStart = new Date(lastCandle.closeTime);
  dayStart.setUTCHours(0, 0, 0, 0);
  const sessionStartMs = dayStart.getTime();

  let cumPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    if (c.closeTime < sessionStartMs) continue;
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumPV += typicalPrice * c.volume;
    cumVol += c.volume;
  }

  if (cumVol === 0) return null;
  return cumPV / cumVol;
}

/**
 * Donchian Channel over `period` CLOSED candles, evaluated against the
 * candles PRECEDING the current one (so "breakout" means the live price
 * pierces a channel built without look-ahead bias).
 */
export function donchian(candles, period = 20) {
  if (candles.length < period + 1) return { upper: null, lower: null };

  // Exclude the most recent (possibly still-forming) candle from the
  // channel calculation — that's the candle we're testing for a breakout.
  const priorCandles = candles.slice(-period - 1, -1);
  const highs = priorCandles.map((c) => c.high);
  const lows = priorCandles.map((c) => c.low);

  return {
    upper: Math.max(...highs),
    lower: Math.min(...lows),
  };
}

/**
 * Volume spike filter: is the latest candle's volume at least `multiplier`x
 * the `period`-length SMA of volume (excluding the latest candle from the
 * average, same look-ahead-safe logic as Donchian above)?
 */
export function volumeSpike(candles, period = 20, multiplier = 1.5) {
  if (candles.length < period + 1) {
    return { isSpike: false, ratio: null, avgVolume: null };
  }

  const priorVolumes = candles.slice(-period - 1, -1).map((c) => c.volume);
  const avgVolume = sma(priorVolumes, period);
  const currentVolume = candles[candles.length - 1].volume;

  if (!avgVolume) return { isSpike: false, ratio: null, avgVolume: null };

  const ratio = currentVolume / avgVolume;
  return { isSpike: ratio >= multiplier, ratio, avgVolume };
}

/**
 * Runs the full indicator suite over a candle buffer and returns a single
 * flat snapshot object — this is what the signal engine and the UI table
 * both consume.
 */
export function computeIndicatorSnapshot(candles, periods) {
  const closes = candles.map((c) => c.close);
  const currentPrice = closes[closes.length - 1] ?? null;

  const emaFast = ema(closes, periods.EMA_FAST);
  const emaSlow = ema(closes, periods.EMA_SLOW);
  const rsiValue = rsi(closes, periods.RSI);
  const vwapValue = vwap(candles);
  const { upper: donchianUpper, lower: donchianLower } = donchian(
    candles,
    periods.DONCHIAN
  );
  const { isSpike: volSpike, ratio: volumeRatio } = volumeSpike(
    candles,
    periods.VOLUME_SMA,
    1.5
  );

  return {
    currentPrice,
    emaFast,
    emaSlow,
    rsi: rsiValue,
    vwap: vwapValue,
    donchianUpper,
    donchianLower,
    volumeRatio,
    volumeSpike: volSpike,
  };
}
