import { createTestDb } from '../../db/testDb';
import { getSetting, setSetting } from '../../settings/repo';
import {
  acceptPendingServer,
  checkServer,
  getServerState,
  hasFeature,
  resetServerState,
  testAddress,
  type HealthClient,
} from '../status';

type Res = Awaited<ReturnType<HealthClient['getJson']>>;

function fake(res: Res): HealthClient {
  return { getJson: jest.fn().mockResolvedValue(res) as HealthClient['getJson'] };
}

const health = (extra: object = {}): Res => ({
  ok: true,
  value: { version: '1.3.0', features: ['bind', 'catalog'], ...extra },
});

describe('checkServer', () => {
  beforeEach(() => resetServerState());

  it('is online and stores version, features and id', async () => {
    const db = createTestDb();
    const s = await checkServer(fake(health({ serverId: 'abc12345-xyz' })), db, () => 42);
    expect(s).toBe('online');
    expect(getSetting(db, 'server.version')).toBe('1.3.0');
    expect(getSetting(db, 'server.features')).toBe('["bind","catalog"]');
    expect(getSetting(db, 'server.id')).toBe('abc12345-xyz');
    expect(getServerState().lastCheckedAt).toBe(42);
    expect(hasFeature('bind')).toBe(true);
    expect(hasFeature('nope')).toBe(false);
  });

  it('is online without serverId and does not save an id', async () => {
    const db = createTestDb();
    expect(await checkServer(fake(health()), db)).toBe('online');
    expect(getSetting(db, 'server.id')).toBeNull();
  });

  it('is offline on timeout and keeps the last known features', async () => {
    const db = createTestDb();
    setSetting(db, 'server.features', '["bind"]');
    expect(await checkServer(fake({ ok: false, reason: 'timeout' }), db)).toBe('offline');
    expect(getServerState().status).toBe('offline');
    expect(hasFeature('bind')).toBe(true);
  });

  it('is unconfigured when the client says so', async () => {
    const db = createTestDb();
    expect(await checkServer(fake({ ok: false, reason: 'unconfigured' }), db)).toBe('unconfigured');
  });

  it('flags mismatch without touching saved settings, and can adopt the new id', async () => {
    const db = createTestDb();
    setSetting(db, 'server.id', 'old-id');
    setSetting(db, 'server.version', '1.0.0');
    expect(await checkServer(fake(health({ serverId: 'new-id' })), db)).toBe('mismatch');
    expect(getSetting(db, 'server.id')).toBe('old-id');
    expect(getSetting(db, 'server.version')).toBe('1.0.0');
    acceptPendingServer(db);
    expect(getSetting(db, 'server.id')).toBe('new-id');
  });

  it('keeps the saved id "A" when another address answers with "B"', async () => {
    const db = createTestDb();
    setSetting(db, 'server.id', 'A');
    setSetting(db, 'server.host', 'other-host');
    expect(await checkServer(fake(health({ serverId: 'B' })), db)).toBe('mismatch');
    expect(getSetting(db, 'server.id')).toBe('A');
  });

  it('never throws even if the client does', async () => {
    const db = createTestDb();
    const client = { getJson: jest.fn().mockRejectedValue(new Error('boom')) } as unknown as HealthClient;
    expect(await checkServer(client, db)).toBe('offline');
  });
});

describe('testAddress', () => {
  it('reports version and elapsed time', async () => {
    const f = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ version: '1.3.0', features: [] }), { status: 200 }),
    );
    let t = 100;
    const r = await testAddress('h', 3993, f, () => (t += 25));
    expect(r).toEqual({ ok: true, version: '1.3.0', ms: 25 });
    expect(f).toHaveBeenCalledWith('http://h:3993/api/health', expect.anything());
  });

  it('fails neutrally on network error, http error and bad body', async () => {
    expect(await testAddress('h', 1, jest.fn().mockRejectedValue(new Error('x')))).toEqual({ ok: false });
    expect(await testAddress('h', 1, jest.fn().mockResolvedValue(new Response('', { status: 404 })))).toEqual({ ok: false });
    expect(await testAddress('h', 1, jest.fn().mockResolvedValue(new Response('{}', { status: 200 })))).toEqual({ ok: false });
  });
});
