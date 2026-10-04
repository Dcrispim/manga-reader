import { drizzle } from "drizzle-orm/expo-sqlite";
import { useMigrations } from "drizzle-orm/expo-sqlite/migrator";
import { openDatabaseSync } from "expo-sqlite";

import migrations from "../../drizzle/migrations";
import * as schema from "./schema";

const expoDb = openDatabaseSync("manga.db", { enableChangeListener: true });

export const db = drizzle(expoDb, { schema });

export interface MigrationsGate {
  success: boolean;
  error: Error | undefined;
}

/**
 * Applies pending migrations. Never throws: a failure is recorded in
 * diag_log (best effort) and returned so the layout can show a neutral screen.
 */
export function useMigrationsGate(): MigrationsGate {
  const { success, error } = useMigrations(db, migrations);
  if (error) {
    try {
      db.insert(schema.diagLog)
        .values({
          // eslint-disable-next-line react-hooks/purity -- error path only; a timestamp for the log row
          at: Date.now(),
          level: "error",
          scope: "db.migrate",
          message: String(error.message ?? error),
        })
        .run();
    } catch {
      // diag_log may not exist if the very first migration failed.
    }
  }
  return { success, error };
}
