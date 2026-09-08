import { getDatabase } from "./mongodb";

const ACCOUNT_ID = "demo";

function withoutUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export async function persistSignal({
  symbol,
  interval,
  candle,
  indicators,
  signal,
  reasons,
  tradePlan,
  price,
  occurredAt,
}) {
  const db = await getDatabase();
  const observedAt = occurredAt || new Date();

  await db.collection("signals").updateOne(
    { symbol, interval, openTime: candle.openTime, signal },
    {
      $setOnInsert: {
        accountId: ACCOUNT_ID,
        symbol,
        interval,
        openTime: candle.openTime,
        signal,
        reasons,
        price,
        indicators,
        tradePlan,
        occurredAt: observedAt,
        createdAt: observedAt,
      },
    },
    { upsert: true }
  );
}

export async function persistTrade({ trade, account }) {
  const db = await getDatabase();
  const now = new Date();

  if (trade) {
    await db.collection("trades").updateOne(
      { accountId: ACCOUNT_ID, id: trade.id },
      {
        $set: withoutUndefined({ ...trade, accountId: ACCOUNT_ID, updatedAt: now }),
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }

  if (account) {
    await db.collection("accountState").updateOne(
      { accountId: ACCOUNT_ID },
      {
        $set: { ...account, accountId: ACCOUNT_ID, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }
}

async function createIndexes() {
  const db = await getDatabase();
  await Promise.all([
    db.collection("signals").createIndex({ symbol: 1, interval: 1, openTime: 1, signal: 1 }, { unique: true }),
    db.collection("trades").createIndex({ accountId: 1, id: 1 }, { unique: true }),
    db.collection("trades").createIndex({ accountId: 1, symbol: 1, status: 1 }),
    db.collection("accountState").createIndex({ accountId: 1 }, { unique: true }),
  ]);
}

const globalForPersistence = globalThis;

export async function ensureIndexes() {
  if (!globalForPersistence.__persistenceIndexesPromise) {
    globalForPersistence.__persistenceIndexesPromise = createIndexes();
  }
  return globalForPersistence.__persistenceIndexesPromise;
}
