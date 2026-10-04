import { describe, expect, it } from "vitest";
import {
  BLIND_CHAPTER_PAGES,
  BLIND_PAGE_BYTES,
  DEFAULT_LIMITS,
  canAdmit,
  planEviction,
  planLruEviction,
  projectChapterBytes,
  type Limits,
  type StoredChapter,
} from "./policy";

const BIG: Limits = { maxPerTitle: 1e9, maxGlobal: 1e9, maxBytes: 1e15 };
const ch = (
  id: string,
  title: string,
  savedAt: number,
  isRead = false,
  bytes = 10,
): StoredChapter => ({ id, title, bytes, savedAt, isRead });

describe("planEviction", () => {
  it("per title: 7 chapters, removes 2, read first", () => {
    const list = [
      ch("a1", "A", 1),
      ch("a2", "A", 2, true),
      ch("a3", "A", 3),
      ch("a4", "A", 4, true),
      ch("a5", "A", 5),
      ch("a6", "A", 6),
      ch("a7", "A", 7),
    ];
    expect(planEviction(list, { ...BIG, maxPerTitle: 5 }, [])).toEqual(["a2", "a4"]);
  });

  it("per title does not touch other titles", () => {
    const list = [ch("a1", "A", 1), ch("a2", "A", 2), ch("b1", "B", 0)];
    expect(planEviction(list, { ...BIG, maxPerTitle: 1 }, [])).toEqual(["a1"]);
  });

  it("global by count", () => {
    const list = [ch("a", "A", 3), ch("b", "B", 1), ch("c", "C", 2)];
    expect(planEviction(list, { ...BIG, maxGlobal: 1 }, [])).toEqual(["b", "c"]);
  });

  it("global by bytes", () => {
    const list = [ch("a", "A", 1, false, 60), ch("b", "B", 2, false, 60), ch("c", "C", 3, false, 60)];
    expect(planEviction(list, { ...BIG, maxBytes: 100 }, [])).toEqual(["a", "b"]);
  });

  it("never lists protected ids", () => {
    const list = [ch("a", "A", 1, true), ch("b", "A", 2), ch("c", "A", 3)];
    const plan = planEviction(list, { ...BIG, maxPerTitle: 1 }, ["a"]);
    expect(plan).toEqual(["b", "c"]);
    expect(plan).not.toContain("a");
  });

  it("all protected: empty plan", () => {
    const list = [ch("a", "A", 1), ch("b", "A", 2)];
    expect(planEviction(list, { maxPerTitle: 0, maxGlobal: 0, maxBytes: 0 }, ["a", "b"])).toEqual([]);
  });

  it("an old unread chapter leaves after a newer read one", () => {
    const list = [ch("oldUnread", "A", 1), ch("newRead", "A", 100, true), ch("x", "A", 50)];
    expect(planEviction(list, { ...BIG, maxPerTitle: 2 }, [])).toEqual(["newRead"]);
    expect(planEviction(list, { ...BIG, maxPerTitle: 1 }, [])).toEqual(["newRead", "oldUnread"]);
  });

  it("does nothing under the limits", () => {
    expect(planEviction([ch("a", "A", 1)], DEFAULT_LIMITS, [])).toEqual([]);
  });

  it("property: limits hold afterwards, or only protected remain above them", () => {
    let seed = 12345;
    const rnd = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const int = (n: number) => Math.floor(rnd() * n);
    for (let run = 0; run < 200; run++) {
      const n = int(30);
      const list = Array.from({ length: n }, (_, i) =>
        ch(`c${i}`, `T${int(4)}`, int(50), rnd() < 0.5, 1 + int(100)),
      );
      const limits: Limits = {
        maxPerTitle: int(6),
        maxGlobal: int(15),
        maxBytes: int(800),
      };
      const prot = list.filter(() => rnd() < 0.2).map((c) => c.id);
      const plan = planEviction(list, limits, prot);

      expect(new Set(plan).size).toBe(plan.length);
      for (const id of plan) expect(prot).not.toContain(id);
      const gone = new Set(plan);
      const left = list.filter((c) => !gone.has(c.id));
      const isProt = (c: StoredChapter) => prot.includes(c.id);

      for (const t of new Set(left.map((c) => c.title))) {
        const inT = left.filter((c) => c.title === t);
        if (inT.length > limits.maxPerTitle) expect(inT.every(isProt)).toBe(true);
      }
      if (left.length > limits.maxGlobal) expect(left.every(isProt)).toBe(true);
      if (left.reduce((s, c) => s + c.bytes, 0) > limits.maxBytes)
        expect(left.every(isProt)).toBe(true);
    }
  });
});

describe("projectChapterBytes", () => {
  it("uses the blind estimate for null", () => {
    expect(projectChapterBytes(null)).toBe(BLIND_CHAPTER_PAGES * BLIND_PAGE_BYTES);
    expect(projectChapterBytes(null)).toBe(15_000_000);
  });
  it("uses the real page count", () => {
    expect(projectChapterBytes(20)).toBe(20_000_000);
    expect(projectChapterBytes(0)).toBe(0);
  });
});

describe("canAdmit", () => {
  it("admits exactly at the limit, refuses one byte below", () => {
    expect(canAdmit(1_015_000_000, 15_000_000, 1_000_000_000)).toBe(true);
    expect(canAdmit(1_014_999_999, 15_000_000, 1_000_000_000)).toBe(false);
  });
});

describe("planLruEviction", () => {
  const items = [
    { id: "a", bytes: 100, lastAccess: 3 },
    { id: "b", bytes: 100, lastAccess: 1 },
    { id: "c", bytes: 100, lastAccess: 2 },
  ];
  it("evicts least recently used until under budget", () => {
    expect(planLruEviction(items, 150, [])).toEqual(["b", "c"]);
  });
  it("skips protected and does nothing when under budget", () => {
    expect(planLruEviction(items, 150, ["b"])).toEqual(["c", "a"]);
    expect(planLruEviction(items, 300, [])).toEqual([]);
  });
});
