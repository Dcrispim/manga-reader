// Shape of <title>_stats.json, written by manga-stats (stats_chart.py in
// manga-downloader), after normalizeStats(): the library holds files from
// several generations of that script, so the raw JSON is read loosely.
export type GroupItem = { chapterNumber: number; value: number; neighborMean: number; localThreshold: number };
export type Group = { start: number; endExclusive: number; items: GroupItem[] };
export type BelowItem = { chapterName: string; value: number };
export type Gap = { start: number; end: number; missingCount: number; withLinks: number[]; withoutLinksCount: number };
export type MetricView = {
  unit: "img" | "px";
  summary: { total: number; mean: number; std: number; globalThreshold: number };
  groups: Group[];
  belowThreshold: BelowItem[];
  belowThresholdGlobal: BelowItem[];
};
export type Metric = "images" | "height";
export type StatsReport = {
  meta: { title: string; generatedAtIso: string; chaptersPerChart: number };
  summary: {
    chapterCount: number;
    imageCountTotal: number;
    mean: number;
    std: number;
    globalThreshold: number;
    trimPercentEachTail?: number;
    neighborWindow?: number;
  };
  chapters: { chapterName: string; imageCount: number }[];
  groups: { start: number; endExclusive: number; items: { chapterNumber: number; imageCount: number; neighborMean: number; localThreshold: number }[] }[];
  gaps: Gap[];
  belowThreshold: { chapterName: string; imageCount: number }[];
  belowThresholdGlobal: { chapterName: string; imageCount: number }[];
  views?: Partial<Record<Metric, MetricView>>;
  // Written by an older manga-stats: no moving average nor height metric.
  legacy: boolean;
};

type Loose<T> = { [K in keyof T]?: T[K] extends object ? Loose<T[K]> : T[K] };
export type RawStats = Loose<StatsReport> & { summary?: { threshold?: number } };

const num = (v: unknown, fallback = NaN) => (typeof v === "number" ? v : fallback);

// Oldest files: no views/neighbor means, `summary.threshold` instead of
// `globalThreshold`, no belowThresholdGlobal, gaps without link info.
// Middle generation: no views. Anything missing becomes a safe default.
export function normalizeStats(raw: RawStats): StatsReport {
  const summary = raw.summary ?? {};
  const mean = num(summary.mean, 0);
  const std = num(summary.std, 0);
  const globalThreshold = num(summary.globalThreshold, num(summary.threshold, mean - std));
  const chapters = (raw.chapters ?? []).map((c) => ({ chapterName: String(c?.chapterName ?? ""), imageCount: num(c?.imageCount, 0) }));
  const below = (xs: RawStats["belowThreshold"]) =>
    (xs ?? []).map((x) => ({ chapterName: String(x?.chapterName ?? ""), imageCount: num(x?.imageCount, 0) }));
  return {
    meta: { title: String(raw.meta?.title ?? ""), generatedAtIso: String(raw.meta?.generatedAtIso ?? ""), chaptersPerChart: num(raw.meta?.chaptersPerChart, 100) },
    summary: {
      chapterCount: num(summary.chapterCount, chapters.length),
      imageCountTotal: num(summary.imageCountTotal, 0),
      mean,
      std,
      globalThreshold,
      trimPercentEachTail: summary.trimPercentEachTail,
      neighborWindow: summary.neighborWindow,
    },
    chapters,
    groups: (raw.groups ?? []).map((g) => ({
      start: num(g?.start, 0),
      endExclusive: num(g?.endExclusive, 0),
      items: (g?.items ?? []).map((it) => ({
        chapterNumber: num(it?.chapterNumber, 0),
        imageCount: num(it?.imageCount, 0),
        neighborMean: num(it?.neighborMean),
        localThreshold: num(it?.localThreshold),
      })),
    })),
    gaps: (raw.gaps ?? []).map((g) => {
      const missingCount = num(g?.missingCount, num(g?.end, 0) - num(g?.start, 0) + 1);
      const withLinks = (g?.withLinks ?? []).filter((n): n is number => typeof n === "number");
      return { start: num(g?.start, 0), end: num(g?.end, 0), missingCount, withLinks, withoutLinksCount: num(g?.withoutLinksCount, missingCount - withLinks.length) };
    }),
    belowThreshold: below(raw.belowThreshold),
    belowThresholdGlobal: raw.belowThresholdGlobal
      ? below(raw.belowThresholdGlobal)
      : chapters.filter((c) => c.imageCount < globalThreshold).sort((a, b) => a.imageCount - b.imageCount),
    views: raw.views as StatsReport["views"],
    legacy: !raw.views,
  };
}

