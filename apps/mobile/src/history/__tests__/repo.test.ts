import { createTestDb } from '../../db/testDb';
import {
  applyMerged,
  isRead,
  latestChapter,
  recordOpen,
  toTitleHistories,
} from '../repo';

describe('history repo', () => {
  it('reopening does not change opened_at', () => {
    const db = createTestDb();
    expect(recordOpen(db, 'A', '1', 100)).toBe(true);
    expect(recordOpen(db, 'A', '1', 999)).toBe(false);
    expect(toTitleHistories(db).A.openedAt).toEqual({ '1': 100 });
  });

  it('derives the 5 most recent chapters and lastRead', () => {
    const db = createTestDb();
    for (let i = 1; i <= 7; i++) recordOpen(db, 'A', String(i), i * 10);
    const h = toTitleHistories(db).A;
    expect(h.history).toEqual(['3', '4', '5', '6', '7']);
    expect(h.lastRead).toBe(70);
    expect(latestChapter(db, 'A')).toBe('7');
    expect(latestChapter(db, 'none')).toBeNull();
  });

  it('applyMerged inserts new as synced and takes max for existing', () => {
    const db = createTestDb();
    recordOpen(db, 'A', '1', 100);
    applyMerged(db, {
      history: {
        A: { lastRead: 500, history: ['1', '2'], openedAt: { '1': 50, '2': 500 } },
      },
      chapters: {},
    });
    expect(toTitleHistories(db).A.openedAt).toEqual({ '1': 100, '2': 500 });
    applyMerged(db, {
      history: { A: { lastRead: 300, history: ['1'], openedAt: { '1': 300 } } },
      chapters: {},
    });
    expect(toTitleHistories(db).A.openedAt['1']).toBe(300);
    expect(isRead(db, 'A', '2')).toBe(true);
    expect(isRead(db, 'A', '3')).toBe(false);
  });
});
