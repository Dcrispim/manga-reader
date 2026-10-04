import { formatDateTime } from '../settings/format';

export interface LogLine {
  at: number;
  level: string;
  scope: string;
  message: string;
}

/** Plain-text rendering used by the export (one line per entry, oldest first). */
export function logToText(lines: LogLine[]): string {
  return lines
    .map((l) => `${formatDateTime(l.at)} [${l.level}] ${l.scope}: ${l.message}`)
    .join('\n');
}
