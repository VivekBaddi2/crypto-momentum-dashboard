import { NextResponse } from "next/server";
import { ensureIndexes, persistSnapshot, persistTrade } from "@/lib/db/persistence";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    await ensureIndexes();

    if (body.type === "snapshot") {
      await persistSnapshot(body);
    } else if (body.type === "trade") {
      await persistTrade(body);
    } else {
      return NextResponse.json({ error: "Unsupported persistence type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Persistence request failed", error);
    return NextResponse.json({ error: "Persistence request failed" }, { status: 500 });
  }
}
