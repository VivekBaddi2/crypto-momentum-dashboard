import { NextResponse } from "next/server";
import { ensureIndexes, persistSignal, persistTrade } from "@/lib/db/persistence";

export const runtime = "nodejs";

export async function POST(request) {
  console.log("Persistence API request received");

  try {
    const body = await request.json();
    console.log(`Persistence type: ${body.type || "missing"}`);
    await ensureIndexes();

    if (body.type === "signal") {
      await persistSignal(body);
    } else if (body.type === "trade") {
      await persistTrade(body);
    } else {
      return NextResponse.json({ error: "Unsupported persistence type" }, { status: 400 });
    }

    console.log("Persistence request completed");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Persistence request failed", error);
    return NextResponse.json({ error: "Persistence request failed" }, { status: 500 });
  }
}
