/**
 * Next chapter in a title's list, plus the whole chapter numbers that the jump
 * leaves out (10 -> 12 skips "11"). Decimals such as 1.5 are real chapters, so
 * 1 -> 1.5 and 1.5 -> 2 skip nothing. Pure, so it is easy to test.
 */
export function nextChapter(
  chapters: string[],
  current: string,
): { next: string | null; skipped: string[] } {
  const cur = parseFloat(current);
  if (!Number.isFinite(cur)) return { next: null, skipped: [] };

  let next: string | null = null;
  let nextNum = Infinity;
  for (const c of chapters) {
    const n = parseFloat(c);
    if (Number.isFinite(n) && n > cur && n < nextNum) {
      next = c;
      nextNum = n;
    }
  }
  if (next === null) return { next: null, skipped: [] };

  const skipped: string[] = [];
  // Cap the walk so a huge gap (10 -> 5000) cannot build a giant list.
  for (let i = Math.floor(cur) + 1; i < nextNum && skipped.length < 1000; i++) {
    skipped.push(String(i));
  }
  return { next, skipped };
}
