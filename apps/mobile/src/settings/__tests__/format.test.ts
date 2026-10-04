import { formatBytes, formatClock, formatDateTime, formatRelative } from '../format';

describe('formatBytes', () => {
  it('formats with pt-BR decimal comma', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1_500)).toBe('1,50 KB');
    expect(formatBytes(12_340_000)).toBe('12,3 MB');
    expect(formatBytes(2_000_000_000)).toBe('2,00 GB');
    expect(formatBytes(150_000_000)).toBe('150 MB');
  });
  it('is safe on garbage', () => {
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});

describe('formatRelative', () => {
  const now = new Date(2026, 9, 4, 12, 0, 0).getTime();
  it('covers the ranges', () => {
    expect(formatRelative(0, now)).toBe('nunca');
    expect(formatRelative(now - 10_000, now)).toBe('agora');
    expect(formatRelative(now - 5 * 60_000, now)).toBe('há 5 min');
    expect(formatRelative(now - 3 * 3_600_000, now)).toBe('há 3 h');
    expect(formatRelative(now - 86_400_000, now)).toBe('há 1 dia');
    expect(formatRelative(now - 3 * 86_400_000, now)).toBe('há 3 dias');
    expect(formatRelative(new Date(2026, 7, 1).getTime(), now)).toBe('01/08/2026');
  });
  it('never goes negative for future timestamps', () => {
    expect(formatRelative(now + 60_000, now)).toBe('agora');
  });
});

describe('dates', () => {
  const t = new Date(2026, 9, 4, 14, 5, 9).getTime();
  it('formats date-time and clock', () => {
    expect(formatDateTime(t)).toBe('04/10/2026 14:05');
    expect(formatClock(t)).toBe('14:05:09');
  });
});
