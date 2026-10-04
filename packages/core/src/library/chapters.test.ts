import { describe, it, expect } from 'vitest';
import { chapterNumber, pickChapterDirs, sortedChapterNumbers } from './chapters';

describe('chapters', () => {
  it('parses numbers like parseFloat and maps NaN to null', () => {
    expect(chapterNumber('0566')).toBe(566);
    expect(chapterNumber('1.5')).toBe(1.5);
    expect(chapterNumber('extras')).toBeNull();
  });

  it('keeps the fullest folder for duplicates and ignores non-numeric', () => {
    const m = pickChapterDirs([
      { name: '566', fileCount: 10 },
      { name: '0566', fileCount: 20 },
      { name: 'extras', fileCount: 99 },
      { name: '1.5', fileCount: 3 },
      { name: '2', fileCount: 4 },
      { name: '02', fileCount: 4 },
    ]);
    expect(m.get(566)).toBe('0566');
    expect(m.get(2)).toBe('2');
    expect(m.has(NaN)).toBe(false);
    expect(sortedChapterNumbers(m)).toEqual([1.5, 2, 566]);
  });
});
