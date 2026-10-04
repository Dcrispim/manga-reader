import { createTestDb } from '../../db/testDb';
import { log, trimLog } from '../log';
import { diagLog } from '../../db/schema';

describe('diag/log', () => {
  describe('log', () => {
    it('should insert a log entry', () => {
      const db = createTestDb();
      const before = db.select().from(diagLog).all().length;

      log(db, 'info', 'test', 'test message');

      const after = db.select().from(diagLog).all().length;
      expect(after).toBe(before + 1);

      const lastLog = db.select().from(diagLog).all().pop();
      expect(lastLog).toMatchObject({
        level: 'info',
        scope: 'test',
        message: 'test message',
      });
    });

    it('should never throw', () => {
      const db = createTestDb();

      expect(() => {
        log(db, 'info', 'test', 'message');
      }).not.toThrow();
    });

    it('should truncate messages longer than 500 characters', () => {
      const db = createTestDb();
      const longMessage = 'x'.repeat(600);

      log(db, 'info', 'test', longMessage);

      const lastLog = db.select().from(diagLog).all().pop();
      expect(lastLog?.message).toHaveLength(500);
      expect(lastLog?.message).toBe('x'.repeat(500));
    });

    it('should keep messages of exactly 500 characters', () => {
      const db = createTestDb();
      const message = 'y'.repeat(500);

      log(db, 'info', 'test', message);

      const lastLog = db.select().from(diagLog).all().pop();
      expect(lastLog?.message).toBe(message);
    });

    it('should preserve timestamp', () => {
      const db = createTestDb();
      const before = Date.now();

      log(db, 'info', 'test', 'message');

      const after = Date.now();
      const lastLog = db.select().from(diagLog).all().pop();
      expect(lastLog?.at).toBeGreaterThanOrEqual(before);
      expect(lastLog?.at).toBeLessThanOrEqual(after);
    });

    it('should handle different log levels', () => {
      const db = createTestDb();

      log(db, 'debug', 'scope1', 'message1');
      log(db, 'info', 'scope2', 'message2');
      log(db, 'warn', 'scope3', 'message3');
      log(db, 'error', 'scope4', 'message4');

      const logs = db.select().from(diagLog).all();
      expect(logs.some((l) => l.level === 'debug')).toBe(true);
      expect(logs.some((l) => l.level === 'info')).toBe(true);
      expect(logs.some((l) => l.level === 'warn')).toBe(true);
      expect(logs.some((l) => l.level === 'error')).toBe(true);
    });

    it('should handle different scopes', () => {
      const db = createTestDb();

      log(db, 'info', 'net', 'network message');
      log(db, 'info', 'db', 'database message');
      log(db, 'info', 'app', 'app message');

      const logs = db.select().from(diagLog).all();
      expect(logs.some((l) => l.scope === 'net')).toBe(true);
      expect(logs.some((l) => l.scope === 'db')).toBe(true);
      expect(logs.some((l) => l.scope === 'app')).toBe(true);
    });
  });

  describe('trimLog', () => {
    it('should not delete entries if count is below max', () => {
      const db = createTestDb();

      // Insert 100 entries
      for (let i = 0; i < 100; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      const before = db.select().from(diagLog).all().length;

      trimLog(db, 5000);

      const after = db.select().from(diagLog).all().length;
      expect(after).toBe(before);
    });

    it('should delete oldest entries when count exceeds max', () => {
      const db = createTestDb();

      // Insert 110 entries
      for (let i = 0; i < 110; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      trimLog(db, 100);

      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBe(100);
    });

    it('should keep newest entries', () => {
      const db = createTestDb();

      // Insert 110 entries with identifiable messages
      for (let i = 0; i < 110; i++) {
        log(db, 'info', 'test', `msg-${i}`);
      }

      trimLog(db, 100);

      const logs = db.select().from(diagLog).all();
      const messages = logs.map((l) => l.message);

      // Should keep the newest 100 (messages 10-109)
      expect(messages).toContain('msg-109');
      expect(messages).not.toContain('msg-0');
    });

    it('should never throw', () => {
      const db = createTestDb();

      for (let i = 0; i < 50; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      expect(() => {
        trimLog(db, 10);
      }).not.toThrow();
    });

    it('should use default max of 5000', () => {
      const db = createTestDb();

      // Insert 100 entries
      for (let i = 0; i < 100; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      const before = db.select().from(diagLog).all().length;

      trimLog(db); // Should use default 5000

      const after = db.select().from(diagLog).all().length;
      expect(after).toBe(before); // No trimming needed
    });

    it('should trim to exactly max entries', () => {
      const db = createTestDb();

      // Insert 250 entries
      for (let i = 0; i < 250; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      trimLog(db, 100);

      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBe(100);
    });

    it('should handle trim with zero max', () => {
      const db = createTestDb();

      for (let i = 0; i < 10; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      trimLog(db, 0);

      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBe(0);
    });

    it('should work with custom max values', () => {
      const db = createTestDb();

      for (let i = 0; i < 1000; i++) {
        log(db, 'info', 'test', `message ${i}`);
      }

      trimLog(db, 500);

      const logs = db.select().from(diagLog).all();
      expect(logs.length).toBe(500);
    });
  });
});
