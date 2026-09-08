# Momentum Terminal

A real-time crypto momentum & breakout dashboard built on Next.js (App Router)
+ React + Tailwind CSS, running entirely on **free, public, key-less** data:

- **Binance public WebSocket API** (`wss://stream.binance.com:9443/stream`) for
  live 15-minute klines and 24h mini-ticker data.
- **Binance public REST API** (`https://api.binance.com/api/v3/klines`) to
  bootstrap candle history on load.

No API keys, no paid tiers, no signup — Binance's market-data endpoints are
public by design.

## Requirements

- Node.js 18.18+ (Next.js 14 requirement)
- npm (or pnpm/yarn if you prefer — just adjust the commands below)

## 1. Install dependencies

```bash
npm install
```

## MongoDB persistence

Copy `.env.example` to `.env.local` and set `MONGODB_URI` to a MongoDB Atlas
connection string. Set `MONGODB_DB` to the database name you want to use. Keep
`.env.local` private; it is ignored by git. The MongoDB URI is used only by the
server-side `/api/persistence` route and is never sent to the browser.

The dashboard persists confirmed signal transitions and paper-trade lifecycle
records, including the signal reasons, indicator values, trade plan, entry,
exit, stop-loss, take-profit, quantity, timing, and P&L. It does not persist
every live candle, ticker update, or indicator recomputation. Writes use
deterministic keys and MongoDB upserts so reconnects and repeated client events
do not create duplicate signal or trade records.

Before using a connection string that has been shared publicly, rotate its
database-user password in MongoDB Atlas and put the replacement value in
`.env.local`.

## 2. Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000**. You should see:

1. A loading state while ~200 candles of 15m history are fetched for the 20
   tracked pairs via REST.
2. The table populate, then a "LIVE" status pill once the WebSocket connects
   and starts streaming ticks.

## 3. Build for production

```bash
npm run build
npm run start
```

## How it works

```
lib/constants.js     Tracked symbols, interval, indicator periods, thresholds
lib/binanceRest.js   REST bootstrap: GET /api/v3/klines per symbol
lib/binanceSocket.js Combined-stream WebSocket client (kline_15m + miniTicker),
                      with auto-reconnect + exponential backoff
lib/indicators.js    SMA, EMA, RSI(14), VWAP, Donchian(20), volume-spike filter
lib/signalEngine.js  BUY / SELL / FORMING / NEUTRAL rules

hooks/useCryptoData.js
  - Bootstraps history, opens the socket, maintains a rolling candle buffer
    per symbol, recomputes indicators + signal on every update, batches
    React state updates (~400ms) so 20 live streams don't thrash re-renders,
    and detects signal *transitions* to append to the alert feed.

components/
  Dashboard.js    Page shell, header, summary counts, layout
  FilterBar.js    Signal filter chips + search + sort
  TickerTable.js  Live-updating table with per-row flash-on-tick animation
  PairChart.js    lightweight-charts candlesticks + VWAP + Donchian + volume
  AlertFeed.js    Time-stamped feed of confirmed BUY/SELL transitions
  SignalBadge.js  Shared colored status pill
```

## Customizing

- **Change tracked pairs**: edit `TRACKED_SYMBOLS` in `lib/constants.js` —
  use any symbol Binance lists against USDT.
- **Change timeframe**: edit `KLINE_INTERVAL` (`"5m"`, `"15m"`, `"1h"`, etc.)
  — Binance supports the same interval strings for both REST and WS.
- **Tune the strategy**: `RSI_BUY_RANGE`, `RSI_SELL_RANGE`,
  `VOLUME_SPIKE_MULTIPLIER`, and `PERIODS` (Donchian/EMA/RSI/volume lookback)
  all live in `lib/constants.js`. The rule logic itself is in
  `lib/signalEngine.js` if you want to add/relax conditions.

## Notes on the free data source

- Binance's public REST endpoints are IP-rate-limited (not key-limited) —
  the REST bootstrap batches requests to stay well under those limits.
- The WebSocket stream needs no auth at all; it will run indefinitely and
  auto-reconnects with backoff if Binance drops the idle connection.
- If Binance is blocked or rate-limited from your network/region, you can
  swap `lib/binanceRest.js` / `lib/binanceSocket.js` for another free public
  source (e.g. CoinGecko's public REST API for a lower-frequency fallback) —
  everything downstream (`indicators.js`, `signalEngine.js`, components) is
  data-source agnostic as long as you feed it the same candle shape:
  `{ openTime, open, high, low, close, volume, closeTime, isFinal }`.
