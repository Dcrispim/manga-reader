import { createTestDb } from '../../db/testDb';
import { getSetting, setSetting } from '../../settings/repo';
import { CURSOR_KEY } from '../catalog';
import { adoptServer } from '../serverSwitch';
import { describeBind, describeCatalog, lastRun, recordOutcome } from '../syncStatus';

jest.mock('expo-image', () => ({
  Image: { clearMemoryCache: jest.fn(async () => true), clearDiskCache: jest.fn(async () => true) },
}));

describe('adoptServer', () => {
  it('adopts the id, rewinds the catalog and disconnects the bind', async () => {
    const db = createTestDb();
    setSetting(db, 'server.id', 'old');
    setSetting(db, CURSOR_KEY, '1791000000000');
    setSetting(db, 'bind.code', 'K4DD32');
    setSetting(db, 'bind.lastSync', '123');
    await adoptServer(db, 'new-server-id');
    expect(getSetting(db, 'server.id')).toBe('new-server-id');
    expect(getSetting(db, CURSOR_KEY)).toBe('0');
    expect(getSetting(db, 'bind.code')).toBe('');
    expect(getSetting(db, 'bind.lastSync')).toBe('0');
  });
});

describe('sync status', () => {
  it('records and reads back the last outcome', () => {
    const db = createTestDb();
    expect(lastRun(db, 'catalog')).toBeNull();
    recordOutcome(db, 'catalog', { changed: 3 }, 42);
    expect(lastRun(db, 'catalog')).toEqual({ at: 42, outcome: { changed: 3 } });
  });

  it('describes catalog and bind outcomes', () => {
    expect(describeCatalog({ changed: 0 })).toEqual({ ok: true, text: 'nada novo' });
    expect(describeCatalog({ changed: 2 }).text).toContain('2');
    expect(describeCatalog({ skipped: 'offline' }).ok).toBe(false);
    expect(describeBind({ status: 'synced', sent: 0 })).toEqual({ ok: true, text: 'em dia' });
    expect(describeBind({ status: 'skipped', why: 'no_code' }).text).toBe('sem bind');
    expect(describeBind({ status: 'failed', reason: 'http' }).ok).toBe(false);
  });
});
