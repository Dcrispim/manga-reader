import { BindDataSchema } from '@manga/api-contract';
import { mergeBindData, type BindData, type BindPayload } from '@manga/core';

import { createTestDb } from '../../db/testDb';
import { history } from '../../db/schema';
import { isRead, recordOpen, toTitleHistories } from '../../history/repo';
import { getSetting, setSetting } from '../../settings/repo';
import {
  connectBind,
  createBind,
  disconnectBind,
  syncBind,
  type BindClient,
} from '../bind';

/** In-memory bind server using the real core merge. */
function fakeServer() {
  const binds = new Map<string, BindData>();
  let n = 0;
  const state = { down: false, failAfterPost: false, posts: 0 };

  const client: BindClient = {
    getJson: (async (path: string) => {
      if (state.down) return { ok: false, reason: 'unreachable' };
      const code = path.split('/').pop() as string;
      const b = binds.get(code);
      if (!b) return { ok: false, reason: 'http', status: 404 };
      return { ok: true, value: BindDataSchema.parse(b) };
    }) as BindClient['getJson'],
    postJson: (async (path: string, body: BindPayload) => {
      if (state.down) return { ok: false, reason: 'unreachable' };
      state.posts++;
      const now = 1000 + state.posts;
      let code = path.split('/').pop() as string;
      let prev = binds.get(code);
      if (path === '/api/bind') {
        code = `CODE0${++n}`;
        prev = undefined;
      } else if (!prev) {
        return { ok: false, reason: 'http', status: 404 };
      }
      const merged = mergeBindData(prev ?? { history: {}, chapters: {} }, body);
      const next: BindData = {
        code,
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        ...merged,
      };
      binds.set(code, next);
      if (state.failAfterPost) {
        state.failAfterPost = false;
        return { ok: false, reason: 'timeout' }; // server applied, device never heard
      }
      return { ok: true, value: BindDataSchema.parse(next) };
    }) as BindClient['postJson'],
  };
  return { client, state, binds };
}

const pendingCount = (db: ReturnType<typeof createTestDb>) =>
  db.select().from(history).all().filter((r) => r.pending === 1).length;

describe('bind sync engine', () => {
  it('two devices converge to the same history', async () => {
    const srv = fakeServer();
    const a = createTestDb();
    const b = createTestDb();
    recordOpen(a, 'X', '1', 100);
    recordOpen(a, 'X', '2', 200);
    const created = await createBind(a, srv.client, 300);
    expect(created.ok).toBe(true);
    const code = created.ok ? created.code : '';

    recordOpen(b, 'X', '3', 400);
    recordOpen(b, 'Y', '9', 450);
    expect((await connectBind(b, srv.client, code)).ok).toBe(true);
    await syncBind({ db: b, client: srv.client, now: 500, status: 'online' });
    recordOpen(a, 'X', '4', 600);
    await syncBind({ db: a, client: srv.client, now: 700, status: 'online' });
    await syncBind({ db: b, client: srv.client, now: 800, status: 'online' });

    expect(toTitleHistories(a)).toEqual(toTitleHistories(b));
    expect(toTitleHistories(a).X.openedAt).toEqual({
      '1': 100, '2': 200, '3': 400, '4': 600,
    });
    expect(pendingCount(a)).toBe(0);
    expect(pendingCount(b)).toBe(0);
  });

  it('repeating a send after a failure post-POST does not change the result', async () => {
    const srv = fakeServer();
    const a = createTestDb();
    const created = await createBind(a, srv.client, 10);
    recordOpen(a, 'X', '1', 100);
    srv.state.failAfterPost = true;
    const r1 = await syncBind({ db: a, client: srv.client, now: 200, status: 'online' });
    expect(r1.status).toBe('failed');
    expect(pendingCount(a)).toBe(1);
    expect(getSetting(a, 'bind.lastSync')).toBe('10');

    const code = created.ok ? created.code : '';
    const afterFirst = JSON.stringify(srv.binds.get(code)?.history);
    const r2 = await syncBind({ db: a, client: srv.client, now: 300, status: 'online' });
    expect(r2.status).toBe('synced');
    const r3 = await syncBind({ db: a, client: srv.client, now: 400, status: 'online' });
    expect(r3.status).toBe('synced');
    expect(JSON.stringify(srv.binds.get(code)?.history)).toBe(afterFirst);
    expect(toTitleHistories(a).X.openedAt).toEqual({ '1': 100 });
    expect(pendingCount(a)).toBe(0);
  });

  it('offline keeps pending rows marked and skips without a code', async () => {
    const srv = fakeServer();
    const a = createTestDb();
    recordOpen(a, 'X', '1', 100);
    expect(
      await syncBind({ db: a, client: srv.client, now: 1, status: 'online' }),
    ).toEqual({ status: 'skipped', why: 'no_code' });

    setSetting(a, 'bind.code', 'CODE01');
    const skipped = await syncBind({ db: a, client: srv.client, now: 2, status: 'offline' });
    expect(skipped).toEqual({ status: 'skipped', why: 'not_online' });
    expect(srv.state.posts).toBe(0);

    srv.state.down = true;
    const failed = await syncBind({ db: a, client: srv.client, now: 3, status: 'online' });
    expect(failed.status).toBe('failed');
    expect(pendingCount(a)).toBe(1);
  });

  it('invalid code returns not_found without throwing', async () => {
    const srv = fakeServer();
    const a = createTestDb();
    await expect(connectBind(a, srv.client, 'NOPE00')).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    });
    expect(getSetting(a, 'bind.code')).toBeNull();
  });

  it('a chapter read on another device becomes read after sync', async () => {
    const srv = fakeServer();
    const a = createTestDb();
    const b = createTestDb();
    recordOpen(a, 'X', '7', 100);
    const c = await createBind(a, srv.client, 200);
    expect(isRead(b, 'X', '7')).toBe(false);
    await connectBind(b, srv.client, c.ok ? c.code.toLowerCase() : '');
    expect(isRead(b, 'X', '7')).toBe(true);
  });

  it('disconnect removes the code and keeps history', async () => {
    const srv = fakeServer();
    const a = createTestDb();
    recordOpen(a, 'X', '1', 100);
    await createBind(a, srv.client, 200);
    disconnectBind(a);
    expect(getSetting(a, 'bind.code')).toBeFalsy();
    expect(isRead(a, 'X', '1')).toBe(true);
    expect(
      await syncBind({ db: a, client: srv.client, now: 1, status: 'online' }),
    ).toEqual({ status: 'skipped', why: 'no_code' });
  });
});
