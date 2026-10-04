// Chapter folder names are numeric (parseFloat semantics: "566", "0566", "1.5").
// Non-numeric folders (e.g. "extras") are not chapters.
export function chapterNumber(name: string): number | null {
  const n = parseFloat(name);
  return Number.isNaN(n) ? null : n;
}

// Several downloads may yield different folders for the same chapter
// ("566" and "0566"). The folder with the most files wins (most complete);
// on a tie the first one in input order is kept.
export function pickChapterDirs(
  entries: { name: string; fileCount: number }[]
): Map<number, string> {
  const best = new Map<number, { name: string; fileCount: number }>();
  for (const entry of entries) {
    const num = chapterNumber(entry.name);
    if (num === null) continue;
    const current = best.get(num);
    if (!current || entry.fileCount > current.fileCount) best.set(num, entry);
  }
  const result = new Map<number, string>();
  for (const [num, entry] of best) result.set(num, entry.name);
  return result;
}

export function sortedChapterNumbers(map: Map<number, string>): number[] {
  return [...map.keys()].sort((a, b) => a - b);
}
