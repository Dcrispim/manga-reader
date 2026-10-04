import { createTestDb } from '../../db/testDb';
import { downloads } from '../../db/schema';
import { recordOpen } from '../../history/repo';
import { clearOpenChapter } from '../../reader/openChapter';
import { commitChapter, chapterTmpDir } from '../../storage/downloads';
import { memoryFileStore } from '../../storage/memoryFileStore';
import { applyLimit, getLimit, limitToText, parseLimit } from '../limits';
import { getSetting } from '../repo';

describe('parseLimit', () => {
  it('enforces minimums and integers', () => {
    expect(parseLimit('space.maxPerTitle', '0')).toEqual({ ok: false, error: 'O mínimo é 1.' });
    expect(parseLimit('space.maxPerTitle', '2.5')).toEqual({
      ok: false,
      error: 'Informe um número inteiro.',
    });
    expect(parseLimit('space.maxPerTitle', 'abc').ok).toBe(false);
    expect(parseLimit('space.maxPerTitle', ' 3 ')).toEqual({ ok: true, value: 3 });
  });
  it('converts MB to bytes and rejects tiny byte caps', () => {
    expect(parseLimit('space.maxBytes', '2000')).toEqual({ ok: true, value: 2_000_000_000 });
    expect(parseLimit('space.maxBytes', '1,5')).toEqual({ ok: false, error: 'O mínimo é 100 MB.' });
    expect(parseLimit('space.transientMaxBytes', '10').ok).toBe(false);
  });
  it('rejects absurd values', () => {
    expect(parseLimit('space.maxGlobal', '999999999').ok).toBe(false);
  });
  it('round-trips through limitToText', () => {
    expect(limitToText('space.maxBytes', 2_000_000_000)).toBe('2000');
    expect(limitToText('space.maxPerTitle', 5)).toBe('5');
  });
});

async function save(
  db: ReturnType<typeof createTestDb>,
  files: ReturnType<typeof memoryFileStore>,
  chapter: string,
) {
  const tmp = chapterTmpDir(files, 'A', chapter);
  files.files.set(`${tmp}/001.jpg`, 100);
  await commitChapter(db, files, { title: 'A', chapter, pages: 1, quality: 'original' });
}

describe('applyLimit', () => {
  beforeEach(() => {
    clearOpenChapter();
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('lowering maxPerTitle evicts immediately, read chapters first', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    for (const [i, c] of ['1', '2', '3'].entries()) {
      jest.setSystemTime(1000 + i);
      await save(db, files, c);
    }
    // Chapter 2 is read: it must go before the older unread 1.
    recordOpen(db, 'A', '2', 5000);
    await applyLimit(db, files, 'space.maxPerTitle', 2);
    const left = db.select().from(downloads).all().map((r) => r.chapter).sort();
    expect(left).toEqual(['1', '3']);
    expect(getSetting(db, 'space.maxPerTitle')).toBe('2');

    await applyLimit(db, files, 'space.maxPerTitle', 1);
    expect(db.select().from(downloads).all()).toHaveLength(1);
  });

  it('raising a limit stores it without evicting', async () => {
    const db = createTestDb();
    const files = memoryFileStore();
    await save(db, files, '1');
    await applyLimit(db, files, 'space.maxPerTitle', 10);
    expect(getLimit(db, 'space.maxPerTitle')).toBe(10);
    expect(db.select().from(downloads).all()).toHaveLength(1);
  });

  it('falls back to the default when unset', () => {
    expect(getLimit(createTestDb(), 'space.maxGlobal')).toBe(100);
  });
});
