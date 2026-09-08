import {
  RSI_BUY_RANGE,
  RSI_SELL_RANGE,
  VOLUME_SPIKE_MULTIPLIER,
  FORMING_PROXIMITY_PCT,
} from "./constants.js";

export const SIGNAL = {
  BUY: "BUY",
  SELL: "SELL",
  NEUTRAL: "NEUTRAL",
  FORMING: "FORMING",
};

/**
 * Evaluates the full breakout/momentum ruleset against one indicator
 * snapshot and returns { signal, reasons, strength }.
 *
 * BUY  = price > Donchian upper AND price > VWAP AND EMA9 > EMA21
 *        AND volume >= 1.5x SMA20(vol) AND RSI in [50, 70]
 * SELL = mirror image on the downside.
 * FORMING = price is close to a Donchian boundary but not all conditions
 *           have confirmed yet (early heads-up, not an entry signal).
 * NEUTRAL = none of the above.
 */
export function evaluateSignal(snapshot) {
  const {
    currentPrice,
    emaFast,
    emaSlow,
    rsi,
    vwap,
    donchianUpper,
    donchianLower,
    volumeRatio,
    volumeSpike,
  } = snapshot;

  // Not enough history yet to say anything meaningful.
  if (
    currentPrice == null ||
    emaFast == null ||
    emaSlow == null ||
    rsi == null ||
    vwap == null ||
    donchianUpper == null ||
    donchianLower == null
  ) {
    return { signal: SIGNAL.NEUTRAL, reasons: ["Warming up — insufficient history"] };
  }

  const brokeUpper = currentPrice > donchianUpper;
  const brokeLower = currentPrice < donchianLower;
  const aboveVwap = currentPrice > vwap;
  const belowVwap = currentPrice < vwap;
  const bullishCross = emaFast > emaSlow;
  const bearishCross = emaFast < emaSlow;
  const hasVolConfirmation = volumeSpike && volumeRatio >= VOLUME_SPIKE_MULTIPLIER;
  const rsiInBuyRange = rsi >= RSI_BUY_RANGE[0] && rsi <= RSI_BUY_RANGE[1];
  const rsiInSellRange = rsi >= RSI_SELL_RANGE[0] && rsi <= RSI_SELL_RANGE[1];

  // ---- BUY: bullish breakout, fully confirmed ----
  if (brokeUpper && aboveVwap && bullishCross && hasVolConfirmation && rsiInBuyRange) {
    return {
      signal: SIGNAL.BUY,
      reasons: [
        "Price broke above 20-period Donchian high",
        "Price above VWAP",
        "EMA9 > EMA21 (bullish trend)",
        `Volume ${volumeRatio.toFixed(2)}x the 20-period average`,
        `RSI ${rsi.toFixed(1)} — strong, not overbought`,
      ],
    };
  }

  // ---- SELL: bearish breakdown, fully confirmed ----
  if (brokeLower && belowVwap && bearishCross && hasVolConfirmation && rsiInSellRange) {
    return {
      signal: SIGNAL.SELL,
      reasons: [
        "Price broke below 20-period Donchian low",
        "Price below VWAP",
        "EMA9 < EMA21 (bearish trend)",
        `Volume ${volumeRatio.toFixed(2)}x the 20-period average`,
        `RSI ${rsi.toFixed(1)} — weak, not oversold`,
      ],
    };
  }

  // ---- FORMING: price approaching a boundary, partial confirmation ----
  const distToUpperPct = ((donchianUpper - currentPrice) / currentPrice) * 100;
  const distToLowerPct = ((currentPrice - donchianLower) / currentPrice) * 100;

  const approachingUpper =
    distToUpperPct >= 0 && distToUpperPct <= FORMING_PROXIMITY_PCT;
  const approachingLower =
    distToLowerPct >= 0 && distToLowerPct <= FORMING_PROXIMITY_PCT;

  if ((approachingUpper || brokeUpper) && (bullishCross || aboveVwap)) {
    return {
      signal: SIGNAL.FORMING,
      reasons: [
        approachingUpper
          ? "Approaching Donchian upper channel"
          : "Above Donchian upper channel, awaiting full confirmation",
        !hasVolConfirmation ? "Waiting on volume confirmation" : null,
        !rsiInBuyRange ? `RSI ${rsi.toFixed(1)} outside 50-70 buy zone` : null,
      ].filter(Boolean),
    };
  }

  if ((approachingLower || brokeLower) && (bearishCross || belowVwap)) {
    return {
      signal: SIGNAL.FORMING,
      reasons: [
        approachingLower
          ? "Approaching Donchian lower channel"
          : "Below Donchian lower channel, awaiting full confirmation",
        !hasVolConfirmation ? "Waiting on volume confirmation" : null,
        !rsiInSellRange ? `RSI ${rsi.toFixed(1)} outside 30-50 sell zone` : null,
      ].filter(Boolean),
    };
  }

  return { signal: SIGNAL.NEUTRAL, reasons: ["Consolidating, no boundary test"] };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Heuristic 0-100 confluence score, NOT a statistical win rate. It rewards
 * stacked confirmation (volume strength, RSI positioning, trend spread,
 * distance from VWAP) on top of the baseline conditions the signal already
 * required. Deliberately clamped away from 0/100 so it never reads as a
 * guarantee — this is a relative-strength readout, not a probability.
 */
function computeWinProbability(snapshot, signal, direction) {
  const { volumeRatio, rsi, emaFast, emaSlow, currentPrice, vwap } = snapshot;

  // Unconfirmed (FORMING) setups start lower and cap out lower — the
  // baseline conditions haven't fully lined up yet.
  if (signal === SIGNAL.FORMING) {
    let score = 38;
    if (volumeRatio != null && volumeRatio >= VOLUME_SPIKE_MULTIPLIER) score += 6;
    if (rsi != null && rsi > 30 && rsi < 70) score += 4;
    return clamp(Math.round(score), 25, 55);
  }

  let score = 50;

  if (volumeRatio != null) {
    if (volumeRatio >= 2.5) score += 12;
    else if (volumeRatio >= 2.0) score += 8;
    else if (volumeRatio >= VOLUME_SPIKE_MULTIPLIER) score += 4;
  }

  const rsiSweetSpot =
    direction === "LONG"
      ? rsi != null && rsi >= 55 && rsi <= 65
      : rsi != null && rsi >= 35 && rsi <= 45;
  if (rsiSweetSpot) score += 10;

  if (emaFast != null && emaSlow != null && currentPrice) {
    const spreadPct = (Math.abs(emaFast - emaSlow) / currentPrice) * 100;
    if (spreadPct > 0.3) score += 10;
    else if (spreadPct > 0.15) score += 5;
  }

  if (vwap != null && currentPrice) {
    const distPct = (Math.abs(currentPrice - vwap) / vwap) * 100;
    // A healthy break away from VWAP is constructive; a huge extension
    // reads as chasing an already-stretched move, so it's penalized.
    if (distPct > 0.1 && distPct < 1.2) score += 8;
    else if (distPct >= 1.2) score -= 6;
  }

  return clamp(Math.round(score), 30, 88);
}

/**
 * Derives a full trade plan (entry / stop-loss / take-profit / risk:reward /
 * heuristic win probability) from an indicator snapshot + signal.
 *
 * Stop-loss uses the Donchian channel as structural invalidation (if price
 * falls back through the opposite boundary, the breakout has failed).
 * Take-profit uses a measured-move projection — the classic breakout target
 * of projecting the channel's own width from the entry, a standard technical
 * heuristic (not a guarantee of where price will actually go).
 *
 * Returns null for NEUTRAL (no setup) or when there isn't enough data yet.
 * For FORMING, returns a plan flagged `isPreview: true` — a preview of what
 * the setup WOULD look like if it fully confirms, not a live trigger.
 */
export function computeTradePlan(snapshot, signal) {
  if (signal === SIGNAL.NEUTRAL) return null;

  const { currentPrice, vwap, donchianUpper, donchianLower } = snapshot;
  if (
    currentPrice == null ||
    donchianUpper == null ||
    donchianLower == null ||
    donchianUpper <= donchianLower
  ) {
    return null;
  }

  const channelWidth = donchianUpper - donchianLower;
  const channelMid = (donchianUpper + donchianLower) / 2;

  // BUY/SELL already imply direction. FORMING doesn't — infer it from
  // which boundary price is closer to / which side of VWAP it's on.
  const direction =
    signal === SIGNAL.SELL
      ? "SHORT"
      : signal === SIGNAL.BUY
      ? "LONG"
      : currentPrice >= channelMid || (vwap != null && currentPrice >= vwap)
      ? "LONG"
      : "SHORT";

  const entry = currentPrice;
  let stopLoss;
  let takeProfit;

  if (direction === "LONG") {
    // Structural stop: back below the lower channel (breakout failed).
    // Fall back to a fraction of channel width if that's somehow >= entry.
    stopLoss =
      donchianLower < entry ? donchianLower : entry - channelWidth * 0.25;
    takeProfit = entry + channelWidth; // measured-move projection
  } else {
    stopLoss =
      donchianUpper > entry ? donchianUpper : entry + channelWidth * 0.25;
    takeProfit = entry - channelWidth; // measured-move projection (downside)
  }

  const risk = Math.abs(entry - stopLoss);
  const reward = Math.abs(takeProfit - entry);
  const riskRewardRatio = risk > 0 ? reward / risk : null;

  return {
    direction,
    entry,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    winProbability: computeWinProbability(snapshot, signal, direction),
    isPreview: signal === SIGNAL.FORMING,
  };
}