// Pure pt-BR formatting for the settings screens (no Intl dependency: Hermes
// ICU coverage varies, so the output must be deterministic).

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Decimal units (1 GB = 1e9 B), matching how the limits are stored. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  let i = 0;
  let v = bytes;
  while (v >= 1000 && i < UNITS.length - 1) {
    v /= 1000;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits).replace('.', ',')} ${UNITS[i]}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "04/10/2026 14:05" in the device's local time. */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "agora", "há 5 min", "há 2 h", "há 3 dias"; falls back to a date after 30 days. */
export function formatRelative(ts: number, now: number): string {
  if (!ts || ts <= 0) return 'nunca';
  const diff = Math.max(0, now - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.floor(h / 24);
  if (days < 30) return days === 1 ? 'há 1 dia' : `há ${days} dias`;
  return formatDateTime(ts).slice(0, 10);
}

/** "HH:MM:SS" for log lines. */
export function formatClock(ts: number): string {
  const d = new Date(ts);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
