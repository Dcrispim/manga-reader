import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import * as schema from "./schema";
import type { Db } from "./types";

// Test-only: applies the same SQL migrations the app ships, on an in-memory
// better-sqlite3 database (expo-sqlite does not exist under Node).
export function createTestDb(): Db {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  const migrationsFolder = path.resolve(__dirname, "../../drizzle");
  if (!fs.existsSync(migrationsFolder)) {
    throw new Error(`migrations folder not found: ${migrationsFolder}`);
  }
  migrate(db, { migrationsFolder });
  return db as unknown as Db;
}
