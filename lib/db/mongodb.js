import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "crypto_momentum_dashboard";

const globalForMongo = globalThis;

export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");

  const clientPromise =
    globalForMongo.__mongoClientPromise ||
    new MongoClient(uri, { maxPoolSize: 10 }).connect();

  if (process.env.NODE_ENV !== "production") {
    globalForMongo.__mongoClientPromise = clientPromise;
  }

  const client = await clientPromise;
  return client.db(dbName);
}
