// Pure space-management rules for downloaded chapters. No I/O: the app feeds
// in what is stored and applies the returned plan.

export type StoredChapter = {
  id: string;
  title: string;
  bytes: number;
  savedAt: number;
  isRead: boolean;
};

export type Limits = { maxPerTitle: number; maxGlobal: number; maxBytes: number };

export const DEFAULT_LIMITS: Limits & {
  minFreeBytes: number;
  transientMaxBytes: number;
} = {
  maxPerTitle: 5,
  maxGlobal: 100,
  maxBytes: 2_000_000_000,
  minFreeBytes: 1_000_000_000,
  transientMaxBytes: 300_000_000,
};

// Blind projection: used when the real size is unknown.
export const BLIND_PAGE_BYTES = 1_000_000;
export const BLIND_CHAPTER_PAGES = 15;

export function projectChapterBytes(pages: number | null): number {
  const n = pages === null || pages < 0 ? BLIND_CHAPTER_PAGES : pages;
  return n * BLIND_PAGE_BYTES;
}

// Read chapters go first (the user already consumed them), then unread ones;
// each group oldest savedAt first. id is the tie-breaker for determinism.
function evictionOrder(chapters: StoredChapter[]): StoredChapter[] {
  return [...chapters].sort(
    (a, b) =>
      Number(b.isRead) - Number(a.isRead) ||
      a.savedAt - b.savedAt ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}

export function planEviction(
  chapters: StoredChapter[],
  limits: Limits,
  protectedIds: string[],
): string[] {
  const guarded = new Set(protectedIds);
  const ordered = evictionOrder(chapters);
  const removed = new Set<string>();
  const plan: string[] = [];

  const evict = (c: StoredChapter) => {
    removed.add(c.id);
    plan.push(c.id);
  };
  const alive = () => ordered.filter((c) => !removed.has(c.id));
  const candidates = (list: StoredChapter[]) =>
    list.filter((c) => !guarded.has(c.id));

  // 1. Per-title count.
  const titles = [...new Set(ordered.map((c) => c.title))];
  for (const title of titles) {
    const inTitle = alive().filter((c) => c.title === title);
    let excess = inTitle.length - limits.maxPerTitle;
    for (const c of candidates(inTitle)) {
      if (excess <= 0) break;
      evict(c);
      excess--;
    }
  }

  // 2. Global count.
  let excess = alive().length - limits.maxGlobal;
  for (const c of candidates(alive())) {
    if (excess <= 0) break;
    evict(c);
    excess--;
  }

  // 3. Global bytes.
  let total = alive().reduce((s, c) => s + c.bytes, 0);
  for (const c of candidates(alive())) {
    if (total <= limits.maxBytes) break;
    evict(c);
    total -= c.bytes;
  }

  // If only protected chapters remain we stop and accept being over a limit.
  return plan;
}

// A download only starts if it leaves the disk floor intact; otherwise the
// job is paused (never failed).
export function canAdmit(
  freeDiskBytes: number,
  projectedBytes: number,
  minFreeBytes: number,
): boolean {
  return freeDiskBytes - projectedBytes >= minFreeBytes;
}

// Transient read cache: plain LRU by lastAccess until under the byte budget.
export function planLruEviction(
  items: { id: string; bytes: number; lastAccess: number }[],
  maxBytes: number,
  protectedIds: string[],
): string[] {
  const guarded = new Set(protectedIds);
  let total = items.reduce((s, i) => s + i.bytes, 0);
  const plan: string[] = [];
  const byAge = [...items].sort(
    (a, b) => a.lastAccess - b.lastAccess || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const it of byAge) {
    if (total <= maxBytes) break;
    if (guarded.has(it.id)) continue;
    plan.push(it.id);
    total -= it.bytes;
  }
  return plan;
}
