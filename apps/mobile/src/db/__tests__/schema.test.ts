import { eq } from "drizzle-orm";

import { createTestDb } from "../testDb";
import * as s from "../schema";

describe("local schema", () => {
  it("applies migrations and seeds the server source", () => {
    const db = createTestDb();
    const rows = db.select().from(s.sources).where(eq(s.sources.id, "server")).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("server");
  });

  it("round-trips one row per table", () => {
    const db = createTestDb();
    db.insert(s.settings).values({ key: "host", value: "10.0.0.2" }).run();
    db.insert(s.sources)
      .values({ id: "saf1", kind: "saf", root: "content://x", label: "SD" })
      .run();
    db.insert(s.titles).values({ name: "Berserk", updatedAt: 1 }).run();
    db.insert(s.chapterSources)
      .values({ title: "Berserk", chapter: "566", sourceId: "server", location: "c1", pages: 15, mtimeMs: 5 })
      .run();
    db.insert(s.downloads)
      .values({ title: "Berserk", chapter: "566", dir: "/d", pages: 15, bytes: 100, savedAt: 2, quality: "original" })
      .run();
    db.insert(s.transientPages)
      .values({ title: "Berserk", chapter: "566", page: 1, path: "/t/1", bytes: 10, lastAccess: 3 })
      .run();
    db.insert(s.jobs)
      .values({ kind: "download", title: "Berserk", chapter: "566", createdAt: 4 })
      .run();
    db.insert(s.history)
      .values({ title: "Berserk", chapter: "566", openedAt: 5 })
      .run();
    db.insert(s.diagLog)
      .values({ at: 6, level: "info", scope: "test", message: "hi" })
      .run();

    expect(db.select().from(s.settings).all()[0].value).toBe("10.0.0.2");
    expect(db.select().from(s.sources).all()).toHaveLength(2);
    expect(db.select().from(s.titles).all()[0].metadataJson).toBe("{}");
    expect(db.select().from(s.chapterSources).all()[0].pages).toBe(15);
    expect(db.select().from(s.downloads).all()[0].quality).toBe("original");
    expect(db.select().from(s.transientPages).all()[0].lastAccess).toBe(3);
    const job = db.select().from(s.jobs).all()[0];
    expect(job).toMatchObject({ state: "queued", attempts: 0, pagesDone: 0 });
    expect(db.select().from(s.history).all()[0].pending).toBe(1);
    expect(db.select().from(s.diagLog).all()[0].id).toBe(1);
  });

  it("enforces the unique job per (kind, title, chapter)", () => {
    const db = createTestDb();
    const v = { kind: "download" as const, title: "T", chapter: "1", createdAt: 1 };
    db.insert(s.jobs).values(v).run();
    expect(() => db.insert(s.jobs).values(v).run()).toThrow();
  });
});
