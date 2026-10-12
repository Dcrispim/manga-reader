"use client";
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lastChapter, planDownload } from "./downloadPlan";
import type { StatsReport } from "./statsReport";

// The chapter URL rarely changes for a title, so it's remembered per title as
// it's typed (even if the download never starts).
const templateKey = (title: string) => `download-template:${title}`;
function loadTemplate(title: string) {
  try {
    return localStorage.getItem(templateKey(title)) ?? "";
  } catch {
    return "";
  }
}
function saveTemplate(title: string, template: string) {
  try {
    localStorage.setItem(templateKey(title), template);
  } catch {
    // private window / blocked storage: just don't remember it
  }
}

type Props = {
  title: string;
  stats: StatsReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStarted: (message: string) => void;
};

export default function DownloadChaptersDialog({ title, stats, open, onOpenChange, onStarted }: Props) {
  const [template, setTemplate] = useState("");
  const [latest, setLatest] = useState("");
  const [update, setUpdate] = useState(false);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTemplate(loadTemplate(title));
    setLatest("");
    setUpdate(false);
    setMessage(null);
  }, [open, title]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const plan = planDownload(stats, template, latest, update);
    if (plan.kind === "invalid") return setMessage({ tone: "error", text: plan.error });
    if (plan.kind === "up-to-date") {
      return setMessage({ tone: "info", text: `Já está atualizado: sem gaps e nada depois do capítulo ${lastChapter(stats)}.` });
    }
    setSending(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/download/${title}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plan.request),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `Falha ao iniciar o download (${res.status})`);
      const { start, end, gaps } = plan.request;
      const what = [start && `capítulos ${start}–${end}`, gaps && "gaps"].filter(Boolean).join(" + ");
      onStarted(`Download iniciado: ${what}${update ? " (sobrescrevendo)" : ""}. O status é atualizado ao terminar.`);
      onOpenChange(false);
    } catch (err) {
      setMessage({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Obter capítulos</DialogTitle>
          <DialogDescription>
            Último capítulo: {lastChapter(stats)} · {stats.gaps.length} gap(s). Roda o manga-download no servidor.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="download-template">URL do capítulo</Label>
            <Input
              id="download-template"
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                saveTemplate(title, e.target.value);
              }}
              placeholder="https://site/manga/titulo/capitulo/{chapter}"
              required
            />
            <p className="text-xs text-muted-foreground">Use {"{chapter}"} onde entra o número do capítulo.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="download-latest">Capítulo mais recente (opcional)</Label>
            <Input id="download-latest" value={latest} onChange={(e) => setLatest(e.target.value)} inputMode="decimal" placeholder="ex.: 106" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={update} onChange={(e) => setUpdate(e.target.checked)} className="h-4 w-4 accent-primary" />
            Sobrescrever (baixa de novo o que já existe na faixa e nos gaps)
          </label>
          {message && (
            <p className={message.tone === "error" ? "text-sm text-destructive whitespace-pre-wrap break-words" : "text-sm text-muted-foreground"}>
              {message.text}
            </p>
          )}
          <DialogFooter>
            <button
              type="submit"
              disabled={sending}
              className="px-4 py-2 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {sending ? "Enviando…" : "Obter"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
