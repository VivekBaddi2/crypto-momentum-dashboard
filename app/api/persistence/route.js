import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { ensureIndexes, loadAccount, persistSignal, persistTrade } from "@/lib/db/persistence";

export const runtime = "nodejs";

const ACCOUNT_COOKIE = "crypto-demo-account";
const MAX_BODY_BYTES = 100_000;

function getAccountId(request) {
  return request.cookies.get(ACCOUNT_COOKIE)?.value || randomUUID();
}

function responseWithAccount(response, accountId, shouldSetCookie) {
  if (shouldSetCookie) {
    response.cookies.set(ACCOUNT_COOKIE, accountId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
  return response;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function validatePayload(body) {
  if (!body || typeof body !== "object" || !["signal", "trade"].includes(body.type)) {
    return "Unsupported persistence type";
  }
  if (body.type === "signal") {
    if (typeof body.symbol !== "string" || typeof body.interval !== "string" ||
        !body.candle || !Number.isSafeInteger(body.candle.openTime) ||
        !["BUY", "SELL", "FORMING", "NEUTRAL"].includes(body.signal) ||
        !isFiniteNumber(body.price)) return "Invalid signal payload";
  } else if (!body.trade && !body.account) {
    return "Trade or account data is required";
  }
  if (body.trade && (typeof body.trade !== "object" || typeof body.trade.id !== "string")) {
    return "Invalid trade payload";
  }
  if (body.account && typeof body.account !== "object") return "Invalid account payload";
  return null;
}

export async function GET(request) {
  const hasCookie = request.cookies.has(ACCOUNT_COOKIE);
  const accountId = getAccountId(request);
  try {
    const account = await loadAccount(accountId);
    return responseWithAccount(NextResponse.json({ account }), accountId, !hasCookie);
  } catch (error) {
    console.error("Account load failed", error);
    return responseWithAccount(NextResponse.json({ error: "Account load failed" }, { status: 500 }), accountId, !hasCookie);
  }
}

export async function POST(request) {
  console.log("Persistence API request received");

  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }
    const validationError = validatePayload(body);
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
    const hasCookie = request.cookies.has(ACCOUNT_COOKIE);
    const accountId = getAccountId(request);
    await ensureIndexes();

    if (body.type === "signal") {
      await persistSignal({ ...body, accountId });
    } else if (body.type === "trade") {
      await persistTrade({ ...body, accountId });
    }

    console.log("Persistence request completed");
    return responseWithAccount(NextResponse.json({ ok: true }), accountId, !hasCookie);
  } catch (error) {
    console.error("Persistence request failed", error);
    return NextResponse.json({ error: "Persistence request failed" }, { status: 500 });
  }
}
