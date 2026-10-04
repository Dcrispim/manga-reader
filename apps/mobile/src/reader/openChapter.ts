// In-memory "which chapter is open in the reader" (setting reader.openChapterId).
// Deliberately not persisted: after a restart nothing is open, and the space
// policy must never evict the chapter being read.

/** Stable id for a (title, chapter) pair; shared with the space policy. */
export function chapterId(title: string, chapter: string): string {
  return `${title}\u0000${chapter}`;
}

let openId: string | null = null;

export function setOpenChapter(title: string, chapter: string): void {
  openId = chapterId(title, chapter);
}

export function clearOpenChapter(): void {
  openId = null;
}

export function getOpenChapterId(): string | null {
  return openId;
}
