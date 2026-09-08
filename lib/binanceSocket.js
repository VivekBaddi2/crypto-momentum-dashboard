import { BINANCE_WS_BASE } from "./constants.js";

/**
 * Wraps Binance's combined-stream WebSocket endpoint. No API key is needed —
 * market data streams are fully public.
 *
 * Combined stream URL shape:
 *   wss://stream.binance.com:9443/stream?streams=btcusdt@kline_15m/btcusdt@miniTicker/...
 *
 * Every message arrives as { stream: "<name>", data: {...} } and is routed
 * to the right handler by stream name suffix.
 *
 * Includes automatic reconnect with exponential backoff, since Binance
 * periodically drops idle connections and free public endpoints don't
 * guarantee uptime SLAs.
 */
export class BinanceStreamManager {
  constructor({ symbols, interval, onKline, onMiniTicker, onStatusChange, WebSocketImpl }) {
    this.symbols = symbols;
    this.interval = interval;
    this.onKline = onKline;
    this.onMiniTicker = onMiniTicker;
    this.onStatusChange = onStatusChange || (() => {});
    this.WebSocketImpl = WebSocketImpl || globalThis.WebSocket;

    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxBackoffMs = 30_000;
    this.manuallyClosed = false;
    this.heartbeatTimer = null;
  }

  buildStreamUrl() {
    const streams = this.symbols.flatMap((s) => {
      const lower = s.toLowerCase();
      return [`${lower}@kline_${this.interval}`, `${lower}@miniTicker`];
    });
    return `${BINANCE_WS_BASE}?streams=${streams.join("/")}`;
  }

  connect() {
    this.manuallyClosed = false;
    const url = this.buildStreamUrl();
    if (!this.WebSocketImpl) throw new Error("WebSocket implementation is unavailable");
    this.ws = new this.WebSocketImpl(url);

    const onOpen = () => {
      this.reconnectAttempts = 0;
      this.onStatusChange("connected");
      this.startHeartbeatWatch();
    };
    const onMessage = (event) => {
      this.lastMessageAt = Date.now();
      try {
        const raw = event?.data ?? event;
        const payload = JSON.parse(typeof raw === "string" ? raw : raw.toString());
        this.routeMessage(payload);
      } catch (err) {
        console.error("Failed to parse Binance WS message", err);
      }
    };
    const onError = (err) => console.error("Binance WS error", err);
    const onClose = () => {
      this.onStatusChange("disconnected");
      this.stopHeartbeatWatch();
      if (!this.manuallyClosed) this.scheduleReconnect();
    };

    if (typeof this.ws.on === "function") {
      this.ws.on("open", onOpen);
      this.ws.on("message", onMessage);
      this.ws.on("error", onError);
      this.ws.on("close", onClose);
    } else {
      this.ws.onopen = onOpen;
      this.ws.onmessage = onMessage;
      this.ws.onerror = onError;
      this.ws.onclose = onClose;
    }
  }

  routeMessage(payload) {
    if (!payload?.stream || !payload?.data) return;
    const { stream, data } = payload;

    if (stream.includes("@kline_")) {
      const symbol = data.s; // e.g. "BTCUSDT"
      const k = data.k;
      this.onKline(symbol, {
        openTime: k.t,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
        closeTime: k.T,
        isFinal: k.x, // true only when this candle has closed
      });
    } else if (stream.includes("@miniticker")) {
      this.onMiniTicker(data.s, {
        lastPrice: parseFloat(data.c),
        open24h: parseFloat(data.o),
        high24h: parseFloat(data.h),
        low24h: parseFloat(data.l),
        volume24h: parseFloat(data.v),
      });
    }
  }

  scheduleReconnect() {
    const delay = Math.min(
      1000 * 2 ** this.reconnectAttempts,
      this.maxBackoffMs
    );
    this.reconnectAttempts += 1;
    this.onStatusChange("reconnecting");
    setTimeout(() => {
      if (!this.manuallyClosed) this.connect();
    }, delay);
  }

  // Binance can silently stop delivering data without closing the socket.
  // If nothing has arrived in 45s, force a reconnect.
  startHeartbeatWatch() {
    this.lastMessageAt = Date.now();
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastMessageAt > 45_000) {
        this.ws?.close();
      }
    }, 10_000);
  }

  stopHeartbeatWatch() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  close() {
    this.manuallyClosed = true;
    this.stopHeartbeatWatch();
    this.ws?.close();
  }
}
