import { MongoClient } from "mongodb";

const dbName = process.env.MONGODB_DB || "crypto_momentum_dashboard";

const globalForMongo = globalThis;

export async function getDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MongoDB connection failed: MONGODB_URI is not configured");
    throw new Error("MONGODB_URI is not configured");
  }

  if (!globalForMongo.__mongoClientPromise) {
    console.log(`MongoDB connection starting: ${dbName}`);
    globalForMongo.__mongoClientPromise = new MongoClient(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
    }).connect();
  }

  try {
    const client = await globalForMongo.__mongoClientPromise;
    const db = client.db(dbName);
    await db.command({ ping: 1 });
    console.log(`MongoDB connected successfully: ${dbName}`);
    return db;
  } catch (error) {
    console.error(`MongoDB connection failed: ${dbName}`, error);
    throw error;
  }
}
