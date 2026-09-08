import { NextResponse } from "next/server";
import { fetchTradableUsdtPairs } from "@/lib/binanceRest";
import { loadPairCatalog, savePairCatalog } from "@/lib/db/persistence";
import { ALLOWED_BASE_ASSETS } from "@/lib/coinAllowlist";

export const runtime = "nodejs";

const CATALOG_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const CATALOG_SOURCE = "user-allowlist-v1";

export async function GET() {
  try {
    const cached = await loadPairCatalog();
    if (cached?.source === CATALOG_SOURCE && cached?.updatedAt && Date.now() - new Date(cached.updatedAt).getTime() < CATALOG_MAX_AGE_MS) {
      return NextResponse.json(cached);
    }

    const binancePairs = await fetchTradableUsdtPairs();
    const pairs = binancePairs
      .filter(({ baseAsset }) => ALLOWED_BASE_ASSETS.includes(baseAsset.toUpperCase()))
      .map(({ symbol, baseAsset }) => ({ symbol, baseAsset }));

    return NextResponse.json(await savePairCatalog({ pairs, source: CATALOG_SOURCE }));
  } catch (error) {
    console.error("Pair catalog refresh failed", error);
    const cached = await loadPairCatalog().catch(() => null);
    if (cached?.source === CATALOG_SOURCE && cached?.pairs?.length) return NextResponse.json(cached);
    return NextResponse.json({ error: "Pair catalog unavailable" }, { status: 503 });
  }
}