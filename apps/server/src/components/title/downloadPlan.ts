import type { StatsReport } from "./statsReport";

// Body of POST /api/download/<title>: becomes
// `manga-download <title> <template> [start end] [--gaps] [--update]`.
export type DownloadRequest = { template: string; start?: string; end?: string; gaps: boolean; update: boolean };

export type DownloadPlan =
  | { kind: "request"; request: DownloadRequest }
  | { kind: "up-to-date" }
  | { kind: "invalid"; error: string };

const CHAPTER = /^\d+(\.\d+)?$/;

export function lastChapter(stats: StatsReport): number {
  const nums = stats.chapters.map((c) => parseFloat(c.chapterName)).filter(Number.isFinite);
  return nums.length ? Math.max(...nums) : 0;
}

// A newer latest chapter adds the range after the last one we have; gaps
// (from the stats) add --gaps. Neither → nothing to fetch. `update`
// ("sobrescrever") re-downloads what the run covers.
export function planDownload(stats: StatsReport, template: string, latestInput: string, update = false): DownloadPlan {
  const tpl = template.trim();
  if (!/^https?:\/\//.test(tpl)) return { kind: "invalid", error: "A URL deve começar com http:// ou https://" };
  if (!tpl.includes("{chapter}")) return { kind: "invalid", error: "A URL deve conter {chapter}" };

  const latestRaw = latestInput.trim();
  if (latestRaw && !CHAPTER.test(latestRaw)) return { kind: "invalid", error: "Capítulo mais recente inválido (use N ou N.k)" };

  const last = lastChapter(stats);
  const latest = latestRaw ? parseFloat(latestRaw) : undefined;
  const newer = latest !== undefined && latest > last;
  const gaps = stats.gaps.length > 0;
  if (!newer && !gaps) return { kind: "up-to-date" };

  if (!newer) return { kind: "request", request: { template: tpl, gaps, update } };
  const start = Math.min(Math.floor(last) + 1, latest);
  return { kind: "request", request: { template: tpl, start: String(start), end: latestRaw, gaps, update } };
}
