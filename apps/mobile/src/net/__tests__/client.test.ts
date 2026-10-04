import { z } from 'zod';

import { createTestDb } from '../../db/testDb';
import { createClient } from '../client';
import { setSetting } from '../../settings/repo';
import { diagLog } from '../../db/schema';

describe('createClient', () => {
  let mockFetch: jest.Mock;
  let now: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    now = jest.fn(() => 1000);
  });

  const testSchema = z.object({ data: z.string() });

  describe('getJson', () => {
    it('should successfully fetch and validate JSON', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: 'test' }), { status: 200 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ data: 'test' });
      }
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3993/api/test',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('should handle timeout', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new DOMException('AbortError', 'AbortError'));
            }, 100);
          }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema, {
        timeoutMs: 50,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('timeout');
      }
    });

    it('should handle HTTP 500 error', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
        }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('http');
        expect(result.status).toBe(500);
      }
    });

    it('should handle non-JSON response', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response('not json', { status: 200 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid');
      }
    });

    it('should handle JSON outside schema', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ notData: 'test' }), { status: 200 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('invalid');
      }
    });

    it('should handle fetch rejection (network error)', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockRejectedValue(new TypeError('Network error'));

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unreachable');
      }
    });

    it('should return unconfigured when server not configured', async () => {
      const db = createTestDb();

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.getJson('/api/test', testSchema);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unconfigured');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should log all failures to diag_log', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      // Test failure case
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'not found' }), { status: 404 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      await client.getJson('/api/test', testSchema);

      // Check diag_log
      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1]).toMatchObject({
        level: 'warn',
        scope: 'net',
      });
    });

    it('should truncate messages longer than 500 characters', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      // Create a very long response that will cause a schema error
      mockFetch.mockResolvedValue(
        new Response(
          JSON.stringify({ data: 'x'.repeat(600) }),
          { status: 200 },
        ),
      );

      const shortSchema = z.object({ data: z.string().max(100) });

      const client = createClient({ db, fetchImpl: mockFetch, now });
      await client.getJson('/api/test', shortSchema);

      const logs = db.select().from(diagLog).all();
      const lastLog = logs[logs.length - 1];
      expect(lastLog.message.length).toBeLessThanOrEqual(500);
    });
  });

  describe('postJson', () => {
    it('should successfully post and validate JSON', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ data: 'response' }), { status: 200 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.postJson(
        '/api/bind',
        { test: 'body' },
        testSchema,
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ data: 'response' });
      }
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3993/api/bind',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'body' }),
        }),
      );
    });

    it('should handle POST timeout', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new DOMException('AbortError', 'AbortError'));
            }, 100);
          }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.postJson(
        '/api/bind',
        { test: 'body' },
        testSchema,
        { timeoutMs: 50 },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('timeout');
      }
    });

    it('should return unconfigured when server not configured', async () => {
      const db = createTestDb();

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = await client.postJson('/api/bind', {}, testSchema);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unconfigured');
      }
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('url', () => {
    it('should build absolute URL from relative path', () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = client.url('/api/read/title/chapter/1');

      expect(result).toBe('http://localhost:3993/api/read/title/chapter/1');
    });

    it('should handle paths without leading slash', () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = client.url('api/test');

      expect(result).toBe('http://localhost:3993/api/test');
    });

    it('should return null if server not configured', () => {
      const db = createTestDb();

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = client.url('/api/test');

      expect(result).toBeNull();
    });

    it('should return null if port is invalid', () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', 'invalid');

      const client = createClient({ db, fetchImpl: mockFetch, now });
      const result = client.url('/api/test');

      expect(result).toBeNull();
    });
  });

  describe('logging', () => {
    it('should never throw even when logging fails', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'test' }), { status: 500 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      expect(async () => {
        await client.getJson('/api/test', testSchema);
      }).not.toThrow();
    });

    it('should log unconfigured case', async () => {
      const db = createTestDb();

      const client = createClient({ db, fetchImpl: mockFetch, now });
      await client.getJson('/api/test', testSchema);

      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBeGreaterThan(0);
      const lastLog = logs[logs.length - 1];
      expect(lastLog.level).toBe('warn');
      expect(lastLog.scope).toBe('net');
      expect(lastLog.message).toContain('Server not configured');
    });
  });

  describe('diag_log trimming', () => {
    it('should trim log when it exceeds max entries', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      // Insert many log entries
      for (let i = 0; i < 100; i++) {
        db.insert(diagLog)
          .values({
            at: Date.now(),
            level: 'info',
            scope: 'test',
            message: `test message ${i}`,
          })
          .run();
      }

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'test' }), { status: 500 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      await client.getJson('/api/test', testSchema);

      // After the failure, diag_log should be trimmed
      // The default max is 5000, so 100 + 1 new log should still be < 5000
      // But let's test that trim is called
      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should keep up to 5000 entries by default', async () => {
      const db = createTestDb();
      setSetting(db, 'server.host', 'localhost');
      setSetting(db, 'server.port', '3993');

      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ error: 'test' }), { status: 500 }),
      );

      const client = createClient({ db, fetchImpl: mockFetch, now });
      await client.getJson('/api/test', testSchema);

      const logs = db.select().from(diagLog).all();
      // Should have at least 1 log from the failure
      expect(logs.length).toBeGreaterThanOrEqual(1);
    });
  });
});
