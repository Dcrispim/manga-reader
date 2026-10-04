import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";

import type * as schema from "./schema";

// Synchronous drizzle database: expo-sqlite in the app, better-sqlite3 in
// Jest. Repositories take this so they run unchanged in both.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the run-result type differs per driver
export type Db = BaseSQLiteDatabase<"sync", any, typeof schema>;
