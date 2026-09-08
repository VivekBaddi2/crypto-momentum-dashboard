import { getDatabase } from "./mongodb";

function withoutUndefined(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

export async function persistSignal({
  accountId,
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
    { accountId, symbol, interval, openTime: candle.openTime, signal },
    {
      $setOnInsert: {
        accountId,
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

export async function persistTrade({ accountId, trade, account }) {
  const db = await getDatabase();
  const now = new Date();

  if (trade) {
    await db.collection("trades").updateOne(
      { accountId, id: trade.id },
      {
        $set: withoutUndefined({ ...trade, accountId, updatedAt: now }),
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }

  if (account) {
    await db.collection("accountState").updateOne(
      { accountId },
      {
        $set: { ...account, accountId, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );
  }
}

async function createIndexes() {
  const db = await getDatabase();
  try {
    await db.collection("signals").dropIndex("symbol_1_interval_1_openTime_1_signal_1");
  } catch (error) {
    if (error.codeName !== "IndexNotFound") throw error;
  }
  await Promise.all([
    db.collection("signals").createIndex(
      { accountId: 1, symbol: 1, interval: 1, openTime: 1, signal: 1 },
      { unique: true, name: "account_signal_identity" }
    ),
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

export async function loadAccount(accountId) {
  const db = await getDatabase();
  return db.collection("accountState").findOne(
    { accountId },
    { projection: { _id: 0, accountId: 0 } }
  );
}
