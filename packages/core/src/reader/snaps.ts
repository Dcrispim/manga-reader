export const SNAP_PARTS = 10;

export function snapOffset(k: number, H: number): number {
  return (k * H) / SNAP_PARTS;
}

export function crossedSnap(prevY: number, y: number, H: number): number | null {
  if (H <= 0 || y <= prevY) return null;
  for (let k = SNAP_PARTS; k >= 1; k--) {
    const offset = snapOffset(k, H);
    if (prevY < offset && offset <= y) return k;
  }
  return null;
}

export function snapStorageKey(title: string, chapter: string): string {
  return `reader.snap.${title}.${chapter}`;
}
