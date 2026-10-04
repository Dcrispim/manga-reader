"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeCategory } from "@/utils/categories";
import { getChapters, getHistory } from "@/utils/history";
import OfflineChapterButton from "@/components/offline/OfflineChapterButton";
import { offlineAwareLinkClick } from "@/utils/offline/navigation";
import { cacheTitleInfo, getCachedTitleInfo } from "@/utils/offline/titleCache";

type Metadata = {
  categories: string[];
  author: string;
  volumes: string;
  status: string;
  type: string;
  demographic: string;
  published: string;
  description: string;
  thumbSource: "curated" | "crop";
};

const EMPTY_METADATA: Metadata = {
  categories: [],
  author: "",
  volumes: "",
  status: "",
  type: "",
  demographic: "",
  published: "",
  description: "",
  thumbSource: "crop",
};

const FACT_LABELS: Array<[keyof Pick<Metadata, "type" | "status" | "demographic" | "published">, string]> = [
  ["type", "Tipo"],
  ["status", "Status"],
  ["demographic", "Demografia"],
  ["published", "Publicação"],
];

type Volume = { label: string; chapters: string[] };

// Mirrors the "same rules, two shapes" behavior chosen for the metadata's
// `volumes` field: a bare count ("17") splits the chapter-number range into
// that many equal parts; a comma list ("1,23,40") is read as the chapter
// number where each volume starts. No `volumes` field at all falls back to
// the app's original 100-chapters-per-page pagination.
function computeVolumes(chapters: string[], volumesField: string): Volume[] {
  if (!chapters.length) return [];

  if (!volumesField) {
    const blocks: Volume[] = [];
    for (let i = 0; i < chapters.length; i += 100) {
      blocks.push({ label: `Bloco ${blocks.length + 1}`, chapters: chapters.slice(i, i + 100) });
    }
    return blocks;
  }

  const nums = chapters.map((c) => parseFloat(c));

  if (volumesField.includes(",")) {
    const points = volumesField
      .split(",")
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    if (!points.length) return computeVolumes(chapters, "");

    const volumes = points
      .map((start, i) => {
        const end = i + 1 < points.length ? points[i + 1] : Infinity;
        return { label: `Volume ${i + 1}`, chapters: chapters.filter((_, idx) => nums[idx] >= start && nums[idx] < end) };
      })
      .filter((v) => v.chapters.length);
    return volumes.length ? volumes : computeVolumes(chapters, "");
  }

  const count = parseInt(volumesField, 10);
  if (!count || count <= 0) return computeVolumes(chapters, "");

  const maxNum = Math.max(...nums);
  const per = maxNum / count;
  const volumes: Volume[] = [];
  for (let i = 0; i < count; i++) {
    const start = i * per;
    const end = i === count - 1 ? Infinity : (i + 1) * per;
    const vol = chapters.filter((_, idx) => nums[idx] >= start && nums[idx] < end);
    if (vol.length) volumes.push({ label: `Volume ${i + 1}`, chapters: vol });
  }
  return volumes.length ? volumes : computeVolumes(chapters, "");
}

function formatDate(ms?: number) {
  if (!ms) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(ms));
}

const TitlePage = () => {
  const params = useParams();
  const title = (params?.title as string) || "";

  const [chapters, setChapters] = useState<string[]>([]);
  const [modified, setModified] = useState<Record<string, number>>({});
  const [metadata, setMetadata] = useState<Metadata>(EMPTY_METADATA);
  const [continueChapter, setContinueChapter] = useState<string | null>(null);
  const [openedAt, setOpenedAt] = useState<Record<string, number>>({});
  const [activeVolume, setActiveVolume] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [thumbOverrideUrl, setThumbOverrideUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!title) return;

    setContinueChapter(getChapters()[title] || null);
    setOpenedAt(getHistory()[title]?.openedAt || {});

    let revokeUrl: string | null = null;

    Promise.all([
      fetch(`/api/read/${title}`).then((res) => {
        if (!res.ok) throw new Error("chapters unavailable");
        return res.json();
      }),
      fetch(`/api/metadata/${title}`).then((res) => {
        if (!res.ok) throw new Error("metadata unavailable");
        return res.json();
      }),
    ])
      .then(([chapterData, metadataRes]) => {
        setChapters(chapterData.chapters || []);
        setModified(chapterData.modified || {});
        setMetadata({ ...EMPTY_METADATA, ...metadataRes });
        // Keeps the offline cache fresh from normal browsing, not just from
        // explicit chapter downloads.
        cacheTitleInfo(title, { chapters: chapterData.chapters, modified: chapterData.modified, metadata: metadataRes });
      })
      .catch(() => {
        // Offline, or the server is unreachable — fall back to whatever was
        // cached the last time this title was browsed or downloaded.
        getCachedTitleInfo(title).then((cached) => {
          if (!cached) return;
          setChapters(cached.chapters);
          setModified(cached.modified);
          setMetadata({ ...EMPTY_METADATA, ...cached.metadata });
          if (cached.thumb) {
            revokeUrl = URL.createObjectURL(cached.thumb);
            setThumbOverrideUrl(revokeUrl);
          }
        });
      });

    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [title]);

  const volumes = useMemo(() => computeVolumes(chapters, metadata.volumes), [chapters, metadata.volumes]);

  useEffect(() => {
    if (!volumes.length) return;
    const target = continueChapter && chapters.includes(continueChapter) ? continueChapter : null;
    const idx = target ? volumes.findIndex((v) => v.chapters.includes(target)) : -1;
    const fallbackIdx = volumes.length - 1;
    setActiveVolume(idx >= 0 ? idx : fallbackIdx);
    const vol = volumes[idx >= 0 ? idx : fallbackIdx];
    setSelected(target || [...vol.chapters].sort((a, b) => parseFloat(b) - parseFloat(a))[0]);
  }, [volumes, continueChapter, chapters]);

  const readCount = Object.keys(openedAt).length;
  const recentChapters = useMemo(
    () => [...chapters].sort((a, b) => (modified[b] || 0) - (modified[a] || 0)).slice(0, 3),
    [chapters, modified]
  );

  function statusOf(chapter: string): "read" | "new" | "unread" {
    if (chapter in openedAt) return "read";
    if (recentChapters.includes(chapter)) return "new";
    return "unread";
  }

  function scrollToLedger(e: React.MouseEvent) {
    e.preventDefault();
    document.getElementById("capitulos")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!title) return null;

  const startChapter = chapters[0];
  const primaryTarget = continueChapter && chapters.includes(continueChapter) ? continueChapter : startChapter;
  const genres = metadata.categories.map(normalizeCategory);
  const facts = FACT_LABELS.filter(([key]) => metadata[key]);
  const activeVol = volumes[activeVolume];
  const orderedRows = activeVol ? [...activeVol.chapters].sort((a, b) => parseFloat(b) - parseFloat(a)) : [];
  const progressPct = chapters.length ? Math.round((readCount / chapters.length) * 100) : 0;

  const modeNote = !metadata.volumes
    ? "Sem campo volumes no metadata — paginado a cada 100 capítulos."
    : metadata.volumes.includes(",")
      ? `Calculado a partir de volumes=${metadata.volumes} (pontos de corte).`
      : `Calculado a partir de volumes=${metadata.volumes} (divisão em partes iguais).`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-[1080px] mx-auto px-6 md:px-8 pb-16">
        <div className="flex items-center pt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Biblioteca
          </Link>
        </div>

        {/* Hero */}
        <section className="relative mt-5 p-6 md:p-9 rounded-2xl bg-card border border-border grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
          <div>
            <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden border border-border shadow-lg">
              <Image
                src={thumbOverrideUrl || `/api/read/${title}/01/thumb`}
                alt={title}
                fill
                className="object-cover"
                sizes="200px"
                onError={() => {
                  if (thumbOverrideUrl) return;
                  getCachedTitleInfo(title).then((cached) => {
                    if (cached?.thumb) setThumbOverrideUrl(URL.createObjectURL(cached.thumb));
                  });
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {metadata.thumbSource === "curated" ? "Capa oficial (.thumb)" : "Recorte automático · pág. 1 do cap. 1"}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <div className="md:col-span-2">
              <h1 className="text-3xl md:text-4xl font-bold capitalize text-balance">{title.replaceAll("-", " ")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {metadata.author || <span className="italic">Autor não informado</span>}
              </p>
            </div>

            <div className="flex flex-col gap-4 min-w-0">
              <p
                className={cn(
                  "text-sm leading-relaxed max-w-[66ch]",
                  metadata.description ? "text-foreground/80" : "italic text-muted-foreground"
                )}
              >
                {metadata.description || "Sinopse não cadastrada para este título."}
              </p>

              <div className="flex flex-wrap items-center gap-3 mt-auto">
                {primaryTarget ? (
                  <Link
                    href={`/read/${title}/${primaryTarget}`}
                    onClick={(e) => offlineAwareLinkClick(e, `/read/${title}/${primaryTarget}`)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    {continueChapter ? `Continuar no cap. ${continueChapter}` : "Começar a ler"}
                  </Link>
                ) : (
                  <span className="text-sm text-muted-foreground italic">Nenhum capítulo encontrado</span>
                )}
                <button
                  onClick={scrollToLedger}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm border border-border text-foreground/80 hover:bg-accent transition-colors"
                >
                  Ver capítulos
                </button>
                {readCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {readCount} de {chapters.length} capítulos lidos
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 md:border-l md:border-border md:pl-6">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ficha técnica</p>
                <dl className="flex flex-col">
                  {facts.map(([key, label]) => (
                    <div key={key} className="flex justify-between items-baseline gap-3 py-2 border-b border-border/60 last:border-none">
                      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                      <dd className="text-sm tabular-nums">{metadata[key]}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between items-baseline gap-3 py-2 border-b border-border/60 last:border-none">
                    <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Capítulos</dt>
                    <dd className="text-sm tabular-nums">{chapters.length}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Gêneros</p>
                <div className="flex flex-wrap gap-2">
                  {genres.length ? (
                    genres.map((g) => (
                      <span key={g} className="text-xs px-3 py-1 rounded-full border border-border bg-secondary text-secondary-foreground">
                        {g}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs px-3 py-1 rounded-full border border-dashed border-border text-muted-foreground italic">
                      Sem categorias cadastradas
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Body: preview rail + chapter ledger */}
        <div id="capitulos" className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 mt-6 items-stretch">
          <aside className="flex flex-col gap-4 p-4 rounded-2xl bg-card border border-border lg:sticky lg:top-6 lg:self-start h-full">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Prévia</p>
            {selected ? (
              <>
                <div className="w-full rounded-lg overflow-hidden border border-border max-h-[500px]">
                  <Image
                    src={`/api/read/${title}/${selected}/0`}
                    alt={`Capítulo ${selected}`}
                    width={800}
                    height={1200}
                    className="w-full h-auto block"
                    sizes="300px"
                  />
                </div>
                <div className="flex flex-col gap-2 mt-auto pt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xl font-bold tabular-nums">Cap. {selected}</span>
                    <span
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border",
                        statusOf(selected) === "read" && "border-primary/40 bg-primary/10 text-primary",
                        statusOf(selected) === "new" && "border-chart-3/40 bg-chart-3/10 text-chart-3",
                        statusOf(selected) === "unread" && "border-border text-muted-foreground"
                      )}
                    >
                      {statusOf(selected) === "read" ? "Lido" : statusOf(selected) === "new" ? "Novo" : "Não lido"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">Modificado em {formatDate(modified[selected])}</span>
                  <Link
                    href={`/read/${title}/${selected}`}
                    onClick={(e) => offlineAwareLinkClick(e, `/read/${title}/${selected}`)}
                    className="mt-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    Ler capítulo {selected} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground italic">Nenhum capítulo disponível.</p>
            )}
          </aside>

          <section className="rounded-2xl bg-card border border-border overflow-hidden flex flex-col">
            <div className="p-5 pb-0 flex items-start justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-semibold">Capítulos</h2>
              <p className="text-xs text-muted-foreground text-right max-w-[38ch]">{modeNote}</p>
            </div>

            <div className="px-5 pt-3">
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                <span>{readCount > 0 ? `${readCount} de ${chapters.length} capítulos lidos` : "Nenhum capítulo lido ainda"}</span>
                <span className="tabular-nums">{progressPct}%</span>
              </div>
            </div>

            {volumes.length > 1 && (
              <div className="flex gap-1 px-5 pt-4 border-b border-border overflow-x-auto">
                {volumes.map((v, idx) => {
                  const nums = v.chapters.map((c) => parseFloat(c));
                  const range = `${Math.min(...nums)}–${Math.max(...nums)}`;
                  return (
                    <button
                      key={v.label}
                      onClick={() => setActiveVolume(idx)}
                      className={cn(
                        "flex-none px-3.5 pb-3 pt-2 text-sm border-b-2 -mb-px transition-colors",
                        idx === activeVolume ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {v.label}
                      <span className="block text-[10px] text-muted-foreground tabular-nums">{range}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-4 px-5 py-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 inline-block" />
                Lido
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full border border-muted-foreground/60 inline-block" />
                Não lido
              </span>
              <span className="inline-flex items-center gap-1.5">
                <i className="w-1.5 h-1.5 rounded-full bg-chart-3 inline-block" />
                Novo
              </span>
            </div>

            <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse">
                <thead>
                  <tr className="sticky top-0 bg-card">
                    <th className="text-left text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-5 py-2 border-b border-border">#</th>
                    <th className="text-left text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-5 py-2 border-b border-border">Capítulo</th>
                    <th className="text-left text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-5 py-2 border-b border-border">Status</th>
                    <th className="text-right text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-5 py-2 border-b border-border">Modificado</th>
                    <th className="text-center text-[10px] uppercase tracking-wide text-muted-foreground font-medium px-5 py-2 border-b border-border">Offline</th>
                    <th className="px-5 py-2 border-b border-border" />
                  </tr>
                </thead>
                <tbody>
                  {orderedRows.length ? (
                    orderedRows.map((chap) => {
                      const status = statusOf(chap);
                      return (
                        <tr
                          key={chap}
                          onClick={() => setSelected(chap)}
                          className={cn(
                            "cursor-pointer border-b border-border/60 hover:bg-accent/50 transition-colors",
                            chap === selected && "bg-accent"
                          )}
                        >
                          <td className="px-5 py-2.5 text-sm text-muted-foreground tabular-nums">{chap}</td>
                          <td className="px-5 py-2.5 text-sm">Capítulo {chap}</td>
                          <td className="px-5 py-2.5">
                            <span className={cn("inline-flex items-center gap-1.5 text-xs", status === "new" && "text-chart-3")}>
                              <i
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full inline-block",
                                  status === "read" && "bg-muted-foreground/60",
                                  status === "unread" && "border border-muted-foreground/60",
                                  status === "new" && "bg-chart-3"
                                )}
                              />
                              {status === "read" ? "Lido" : status === "new" ? "Novo" : "Não lido"}
                            </span>
                          </td>
                          <td className="px-5 py-2.5 text-sm text-muted-foreground text-right tabular-nums">{formatDate(modified[chap])}</td>
                          <td className="px-5 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-center">
                              <OfflineChapterButton title={title} chapter={chap} />
                            </div>
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <Link
                              href={`/read/${title}/${chap}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                offlineAwareLinkClick(e, `/read/${title}/${chap}`)
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <ArrowRight className="w-4 h-4 inline" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-sm text-muted-foreground text-center italic">
                        Nenhum capítulo encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TitlePage;
