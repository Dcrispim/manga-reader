"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Download, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import DownloadChaptersDialog from "./DownloadChaptersDialog";
import { normalizeStats, type BelowItem, type Gap, type Group, type GroupItem, type Metric, type MetricView, type StatsReport } from "./statsReport";

// Same palette as the standalone HTML report, so both read the same way.
const COLORS = { accent: "#6366f1", danger: "#ef4444", ok: "#22c55e", warn: "#f97316", neighbor: "rgba(148,163,184,0.95)" };

const SECTIONS = [
  ["charts", "Gráficos"],
  ["gaps", "Gaps"],
  ["below", "Abaixo da média"],
] as const;
type Section = (typeof SECTIONS)[number][0];

function legacyImagesView(data: StatsReport): MetricView {
  const toBelow = (xs: { chapterName: string; imageCount: number }[]) => xs.map((x) => ({ chapterName: x.chapterName, value: x.imageCount }));
  return {
    unit: "img",
    summary: { total: data.summary.imageCountTotal, mean: data.summary.mean, std: data.summary.std, globalThreshold: data.summary.globalThreshold },
    groups: data.groups.map((g) => ({ ...g, items: g.items.map((it) => ({ ...it, value: it.imageCount })) })),
    belowThreshold: toBelow(data.belowThreshold),
    belowThresholdGlobal: toBelow(data.belowThresholdGlobal),
  };
}

function formatGeneratedAt(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "data desconhecida" : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function formatValue(v: number, unit: MetricView["unit"]) {
  if (!Number.isFinite(v)) return String(v);
  if (unit === "px") return (v >= 10000 ? (v / 1000).toFixed(1) + "k" : String(Math.round(v))) + " px";
  return String(Math.round(v * 10) / 10) + " img";
}

function formatAxis(v: number, unit: MetricView["unit"]) {
  return unit === "px" && v >= 1000 ? Math.round(v / 1000) + "k" : String(v);
}

function compressRanges(nums: number[]) {
  const out: string[] = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++;
    out.push(i === j ? String(nums[i]) : `${nums[i]}-${nums[j]}`);
    i = j;
  }
  return out.join(", ");
}

const chapterNum = (name: string) => {
  const n = parseFloat(name);
  return Number.isFinite(n) ? n : Infinity;
};
const chapterLabel = (name: string) => {
  const n = chapterNum(name);
  return Number.isFinite(n) ? String(n) : name;
};

// Runs of consecutive chapters collapse into one expandable card.
function groupSequential(items: BelowItem[]): BelowItem[][] {
  const runs: BelowItem[][] = [];
  for (const it of items) {
    const last = runs[runs.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && Math.abs(chapterNum(it.chapterName) - chapterNum(prev.chapterName) - 1) < 1e-9) last.push(it);
    else runs.push([it]);
  }
  return runs;
}

function drawBarChart(canvas: HTMLCanvasElement, group: Group, summary: MetricView["summary"], unit: MetricView["unit"]) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(10, Math.floor(rect.width * dpr));
  const h = Math.max(10, Math.floor(rect.height * dpr));
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const items = group.items;
  const maxVal = Math.max(1, ...items.map((x) => x.value || 0), ...items.map((x) => x.neighborMean || 0), ...items.map((x) => x.localThreshold || 0));
  const fallbackTh = summary.mean - summary.std;
  const localTh = (it: GroupItem) => (Number.isFinite(it.localThreshold) ? it.localThreshold : fallbackTh);
  // Axis/grid ink follows the page's text color, so it works in both themes.
  const ink = getComputedStyle(canvas).color;

  const padL = Math.floor(38 * dpr);
  const padR = Math.floor(12 * dpr);
  const padT = Math.floor(12 * dpr);
  const padB = Math.floor(34 * dpr);
  const plotW = Math.max(1, w - padL - padR);
  const plotH = Math.max(1, h - padT - padB);
  const yFor = (val: number) => padT + (plotH - (Math.max(0, Math.min(maxVal, val)) / maxVal) * plotH);

  ctx.clearRect(0, 0, w, h);

  const gridSteps = 4;
  ctx.save();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.1;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padT + Math.round(plotH * (i / gridSteps));
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
  }
  ctx.restore();

  const n = Math.max(1, items.length);
  const gap = Math.max(1, Math.floor(plotW / (n * 10)));
  const barW = Math.max(1, Math.floor((plotW - gap * (n - 1)) / n));
  const centerX = (i: number) => padL + i * (barW + gap) + barW / 2;

  items.forEach((it, i) => {
    const y = yFor(it.value || 0);
    ctx.fillStyle = (it.value || 0) < localTh(it) ? COLORS.danger : COLORS.accent;
    ctx.fillRect(padL + i * (barW + gap), y, barW, Math.max(1, padT + plotH - y));
  });

  const line = (color: string, dash: number[], width: number, points: [number, number][]) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.setLineDash(dash.map((d) => d * dpr));
    ctx.lineWidth = width;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
    ctx.restore();
  };
  line(COLORS.ok, [6, 4], 2, [
    [padL, yFor(summary.mean)],
    [w - padR, yFor(summary.mean)],
  ]);
  line(
    COLORS.neighbor,
    [4, 3],
    1.25 * dpr,
    items.flatMap((it, i) => (Number.isFinite(it.neighborMean) ? [[centerX(i), yFor(it.neighborMean)] as [number, number]] : []))
  );
  line(COLORS.warn, [2, 5], 2, items.map((it, i) => [centerX(i), yFor(localTh(it))]));

  ctx.save();
  ctx.fillStyle = ink;
  ctx.globalAlpha = 0.7;
  ctx.font = `${Math.floor(11 * dpr)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= gridSteps; i++) {
    ctx.fillText(formatAxis(Math.round(maxVal * (1 - i / gridSteps)), unit), padL - 6 * dpr, padT + Math.round(plotH * (i / gridSteps)));
  }
  ctx.globalAlpha = 0.55;
  ctx.font = `${Math.floor(10 * dpr)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const step = Math.max(1, Math.floor(items.length / 25));
  for (let i = 0; i < items.length; i += step) {
    ctx.fillText(String(items[i].chapterNumber), centerX(i), padT + plotH + 8 * dpr);
  }
  ctx.restore();
}

function BarChart({ group, summary, unit }: { group: Group; summary: MetricView["summary"]; unit: MetricView["unit"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => drawBarChart(canvas, group, summary, unit);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [group, summary, unit]);
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="text-sm font-semibold">
          Capítulos {group.start}–{group.endExclusive - 1}
        </span>
        <span className="text-xs text-muted-foreground">{group.items.length} capítulos</span>
      </div>
      <canvas ref={ref} aria-label="Gráfico de barras" className="block w-full h-[260px] rounded-lg text-foreground" />
    </div>
  );
}

function ToggleButton({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs border transition-colors",
        pressed ? "border-primary/50 bg-primary/10 text-foreground font-semibold" : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </button>
  );
}

function LegendDot({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className="w-2 h-2 rounded-full inline-block" style={{ background: color }} />
      {children}
    </span>
  );
}

// Floating preview of the chapter's last page, following the cursor. The
// frame is a reversed column, so a strip taller than it shows its bottom —
// what matters is whether the chapter really ends there or got cut short.
function LastPagePreview({ src, chapter, pos }: { src: string; chapter: string; pos: { x: number; y: number } }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measure = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r && (r.width !== size.w || r.height !== size.h)) setSize({ w: r.width, h: r.height });
  };
  useEffect(measure);

  const pad = 16;
  let x = pos.x + pad;
  let y = pos.y + pad;
  if (x + size.w > window.innerWidth - 8) x = pos.x - size.w - pad;
  if (y + size.h > window.innerHeight - 8) y = Math.max(8, window.innerHeight - size.h - 8);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[1000] pointer-events-none rounded-lg border border-border bg-card p-1.5 shadow-2xl"
      style={{ left: Math.max(8, x), top: y }}
    >
      <div className="flex flex-col-reverse w-[320px] max-h-[70vh] overflow-hidden rounded-md">
        {/* eslint-disable-next-line @next/next/no-img-element -- raw API image, sized by the frame */}
        <img src={src} alt="" className="block w-full h-auto flex-none" onLoad={measure} />
      </div>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">Última página · cap. {chapter}</p>
    </div>,
    document.body
  );
}

function ChapterCard({ title, item, unit }: { title: string; item: BelowItem; unit: MetricView["unit"] }) {
  const chapter = chapterLabel(item.chapterName);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const track = (e: React.MouseEvent) => setHoverPos({ x: e.clientX, y: e.clientY });
  return (
    <>
      <Link
        href={`/read/${title}/${chapter}`}
        onMouseEnter={track}
        onMouseMove={track}
        onMouseLeave={() => setHoverPos(null)}
        className="block rounded-xl border border-border bg-background/40 p-3 hover:border-primary/50 hover:bg-accent/50 transition-colors"
      >
        <span className="block text-sm font-semibold">Cap. {chapter}</span>
        <span className="block mt-1 text-xs text-muted-foreground tabular-nums">{formatValue(item.value, unit)}</span>
      </Link>
      {hoverPos && <LastPagePreview src={`/api/read/${title}/${chapter}/last`} chapter={chapter} pos={hoverPos} />}
    </>
  );
}

function BelowSection({ title, view }: { title: string; view: MetricView }) {
  const [mode, setMode] = useState<"moving" | "global">("moving");
  const [sort, setSort] = useState<"chapter" | "value">("chapter");
  const [openRun, setOpenRun] = useState<number | null>(null);

  const raw = mode === "global" ? view.belowThresholdGlobal : view.belowThreshold;
  const sorted = useMemo(
    () =>
      [...raw].sort((a, b) =>
        sort === "chapter"
          ? chapterNum(a.chapterName) - chapterNum(b.chapterName) || a.value - b.value
          : a.value - b.value || chapterNum(a.chapterName) - chapterNum(b.chapterName)
      ),
    [raw, sort]
  );
  const runs = sort === "chapter" ? groupSequential(sorted) : sorted.map((it) => [it]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <ToggleButton pressed={mode === "moving"} onClick={() => (setMode("moving"), setOpenRun(null))}>
          Média móvel (vizinhos − σ)
        </ToggleButton>
        <ToggleButton pressed={mode === "global"} onClick={() => (setMode("global"), setOpenRun(null))}>
          Média geral (global − σ)
        </ToggleButton>
        <span className="w-px bg-border mx-1" />
        <ToggleButton pressed={sort === "chapter"} onClick={() => (setSort("chapter"), setOpenRun(null))}>
          Ordenar por capítulo
        </ToggleButton>
        <ToggleButton pressed={sort === "value"} onClick={() => (setSort("value"), setOpenRun(null))}>
          {view.unit === "px" ? "Ordenar por altura" : "Ordenar por páginas"}
        </ToggleButton>
      </div>
      <p className="text-xs text-muted-foreground">
        Total: {raw.length} capítulo(s) ·{" "}
        {mode === "global" ? `abaixo de média global − σ (limite ${formatValue(view.summary.globalThreshold, view.unit)})` : "abaixo da média dos vizinhos − σ"}
      </p>
      {raw.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Nenhum capítulo abaixo do limite.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
          {runs.map((run, idx) => {
            if (run.length === 1) return <ChapterCard key={run[0].chapterName} title={title} item={run[0]} unit={view.unit} />;
            const values = run.map((x) => x.value);
            const lo = Math.min(...values);
            const hi = Math.max(...values);
            const open = openRun === idx;
            return (
              <div key={run[0].chapterName} className={cn("col-span-2", open && "col-span-full")}>
                <button
                  type="button"
                  onClick={() => setOpenRun(open ? null : idx)}
                  className="w-full text-left rounded-xl border border-border bg-background/40 p-3 hover:border-primary/50 hover:bg-accent/50 transition-colors"
                >
                  <span className="block text-sm font-semibold">
                    Cap. {chapterLabel(run[0].chapterName)}–{chapterLabel(run[run.length - 1].chapterName)}
                  </span>
                  <span className="block mt-1 text-xs text-muted-foreground tabular-nums">
                    {lo === hi ? formatValue(lo, view.unit) : `${formatValue(lo, view.unit)} – ${formatValue(hi, view.unit)}`}
                  </span>
                  <span className="block mt-1 text-[11px] text-muted-foreground">
                    {run.length} capítulos · {open ? "clique para recolher" : "clique para ver"}
                  </span>
                </button>
                {open && (
                  <div className="mt-2.5 grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
                    {run.map((it) => (
                      <ChapterCard key={it.chapterName} title={title} item={it} unit={view.unit} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GapsSection({ gaps }: { gaps: Gap[] }) {
  const missing = gaps.reduce((n, g) => n + g.missingCount, 0);
  const linked = gaps.reduce((n, g) => n + g.withLinks.length, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Total: {gaps.length} gap(s) · {missing} capítulo(s) sem imagens, {linked} já com links em chapters/
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <LegendDot color={COLORS.ok}>todos com links (só falta baixar)</LegendDot>
        <LegendDot color={COLORS.warn}>parcialmente com links</LegendDot>
        <LegendDot color="var(--border)">sem links</LegendDot>
      </div>
      {gaps.length === 0 ? (
        <p className="text-sm italic text-muted-foreground">Nenhum gap encontrado.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2.5">
          {gaps.map((g) => {
            const all = g.withLinks.length === g.missingCount;
            const some = g.withLinks.length > 0;
            const color = all ? COLORS.ok : some ? COLORS.warn : undefined;
            return (
              <div key={g.start} className="rounded-xl border border-border bg-background/40 p-3" style={color ? { borderColor: color } : undefined}>
                <span className="block text-sm font-semibold tabular-nums">{g.start === g.end ? g.start : `${g.start}-${g.end}`}</span>
                <span className="block mt-1 text-xs text-muted-foreground">Faltando: {g.missingCount}</span>
                {some && (
                  <span className="block mt-1 text-xs" style={{ color }}>
                    Links em chapters/: {all ? "todos" : compressRanges(g.withLinks)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TitleStatusPanel({ title }: { title: string }) {
  const [data, setData] = useState<StatsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>("images");
  const [section, setSection] = useState<Section>("charts");
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/stats/${title}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json ? normalizeStats(json) : null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [title]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch(`/api/stats/${title}`, { method: "POST" });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Falha ao atualizar (${res.status})`);
      setData(normalizeStats(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  }, [title]);

  const views = useMemo(() => {
    if (!data) return null;
    const images = data.views?.images ?? legacyImagesView(data);
    return { images, height: data.views?.height };
  }, [data]);
  const view = (metric === "height" && views?.height) || views?.images;

  const refreshButton = (
    <button
      type="button"
      onClick={refresh}
      disabled={refreshing}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
    >
      <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
      {refreshing ? "Atualizando…" : "Atualizar status"}
    </button>
  );

  return (
    <section className="rounded-2xl bg-card border border-border p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Status do título</h2>
          {data && (
            <p className="mt-1 text-xs text-muted-foreground">
              Gerado em {formatGeneratedAt(data.meta.generatedAtIso)} ·{" "}
              {data.summary.chapterCount} capítulos · {data.summary.imageCountTotal} imagens
              {views?.height && ` · ${(views.height.summary.total / 1e6).toFixed(1)}M px de altura`}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {/* The plan (range after the last chapter, gaps) comes from the stats. */}
          <button
            type="button"
            onClick={() => setDownloadOpen(true)}
            disabled={!data}
            title={data ? undefined : "Gere o status primeiro"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-border hover:bg-accent disabled:opacity-60 transition-colors"
          >
            <Download className="w-4 h-4" />
            Obter capítulos
          </button>
          {refreshButton}
        </div>
      </div>

      {data && (
        <DownloadChaptersDialog title={title} stats={data} open={downloadOpen} onOpenChange={setDownloadOpen} onStarted={setNotice} />
      )}
      {notice && <p className="text-sm text-muted-foreground">{notice}</p>}
      {error && <p className="text-sm text-destructive whitespace-pre-wrap break-words">{error}</p>}

      {data?.legacy && (
        <p className="text-xs rounded-lg border border-chart-3/40 bg-chart-3/10 text-foreground/80 px-3 py-2">
          Este status foi gerado por uma versão antiga do manga-stats (sem média móvel nem métrica de altura). Use “Atualizar status” para regerar.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : !data || !view ? (
        <p className="text-sm italic text-muted-foreground">
          Nenhum status gerado para este título ainda. Use “Atualizar status” para rodar o manga-stats.
        </p>
      ) : (
        <>
          {views?.height && (
            <div className="flex flex-wrap gap-2">
              <ToggleButton pressed={metric === "images"} onClick={() => setMetric("images")}>
                Métrica: nº de imagens
              </ToggleButton>
              <ToggleButton pressed={metric === "height"} onClick={() => setMetric("height")}>
                Métrica: altura total (px)
              </ToggleButton>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {[
              ["Média", formatValue(view.summary.mean, view.unit)],
              ["Desvio", formatValue(view.summary.std, view.unit)],
              ["Limite global (média−σ)", formatValue(view.summary.globalThreshold, view.unit)],
              ["Gaps", String(data.gaps.length)],
              ["Abaixo da média móvel", String(view.belowThreshold.length)],
            ].map(([label, value]) => (
              <span key={label} className="text-xs px-3 py-1.5 rounded-full border border-border bg-secondary text-secondary-foreground">
                {label}: <span className="tabular-nums font-semibold">{value}</span>
              </span>
            ))}
          </div>

          <div role="tablist" aria-label="Status" className="flex gap-1 border-b border-border">
            {SECTIONS.map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={section === key}
                onClick={() => setSection(key)}
                className={cn(
                  "px-3.5 pb-2.5 pt-1 text-sm border-b-2 -mb-px transition-colors",
                  section === key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {section === "charts" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <LegendDot color={COLORS.accent}>Normal (≥ limite local)</LegendDot>
                <LegendDot color={COLORS.danger}>Abaixo do limite local</LegendDot>
                <LegendDot color={COLORS.ok}>Média global</LegendDot>
                <LegendDot color={COLORS.warn}>Limite local (viz.−σ)</LegendDot>
                <LegendDot color={COLORS.neighbor}>Média vizinhos</LegendDot>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {view.groups.map((g) => (
                  <BarChart key={g.start} group={g} summary={view.summary} unit={view.unit} />
                ))}
              </div>
            </div>
          )}
          {section === "gaps" && <GapsSection gaps={data.gaps} />}
          {section === "below" && <BelowSection title={title} view={view} />}
        </>
      )}
    </section>
  );
}
