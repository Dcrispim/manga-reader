import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

// The SQLite file is the single source of truth for the UI; sync engines are
// the only writers. All timestamps are epoch milliseconds unless noted.

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value"),
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["server", "saf"] }).notNull(),
  root: text("root").notNull().default(""),
  label: text("label").notNull().default(""),
  status: text("status", { enum: ["ok", "unavailable", "scanning"] })
    .notNull()
    .default("ok"),
  lastScanAt: integer("last_scan_at"),
  scanCursor: text("scan_cursor"),
  ignoredJson: text("ignored_json").notNull().default("[]"),
});

export const titles = sqliteTable("titles", {
  name: text("name").primaryKey(),
  metadataJson: text("metadata_json").notNull().default("{}"),
  categoriesJson: text("categories_json").notNull().default("[]"),
  thumbVersion: text("thumb_version"),
  thumbPath: text("thumb_path"),
  serverMtime: integer("server_mtime"),
  updatedAt: integer("updated_at").notNull(),
});

export const chapterSources = sqliteTable(
  "chapter_sources",
  {
    title: text("title").notNull(),
    // Canonical number as a string ("566" and "0566" are the same chapter).
    chapter: text("chapter").notNull(),
    sourceId: text("source_id").notNull(),
    // Server chapter id, or a SAF URI / local path.
    location: text("location").notNull(),
    pages: integer("pages"),
    mtimeMs: integer("mtime_ms").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.title, t.chapter, t.sourceId] }),
    index("chapter_sources_title_idx").on(t.title),
  ],
);

export const downloads = sqliteTable(
  "downloads",
  {
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    dir: text("dir").notNull(),
    pages: integer("pages").notNull(),
    bytes: integer("bytes").notNull(),
    savedAt: integer("saved_at").notNull(),
    quality: text("quality", { enum: ["original", "xl"] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.title, t.chapter] }),
    index("downloads_saved_at_idx").on(t.savedAt),
  ],
);

export const transientPages = sqliteTable(
  "transient_pages",
  {
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    page: integer("page").notNull(),
    path: text("path").notNull(),
    bytes: integer("bytes").notNull(),
    lastAccess: integer("last_access").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.title, t.chapter, t.page] }),
    index("transient_pages_last_access_idx").on(t.lastAccess),
  ],
);

export const jobs = sqliteTable(
  "jobs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["download", "upgrade"] }).notNull(),
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    state: text("state", {
      enum: ["queued", "running", "paused", "done", "failed"],
    })
      .notNull()
      .default("queued"),
    pagesDone: integer("pages_done").notNull().default(0),
    pagesTotal: integer("pages_total"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: integer("next_attempt_at").notNull().default(0),
    lastError: text("last_error"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    unique("jobs_kind_title_chapter_uq").on(t.kind, t.title, t.chapter),
    index("jobs_state_next_attempt_idx").on(t.state, t.nextAttemptAt),
  ],
);

export const history = sqliteTable(
  "history",
  {
    title: text("title").notNull(),
    chapter: text("chapter").notNull(),
    openedAt: integer("opened_at").notNull(),
    // 1 = not yet sent to the bind.
    pending: integer("pending").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.title, t.chapter] })],
);

export const diagLog = sqliteTable("diag_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: integer("at").notNull(),
  level: text("level").notNull(),
  scope: text("scope").notNull(),
  message: text("message").notNull(),
});

