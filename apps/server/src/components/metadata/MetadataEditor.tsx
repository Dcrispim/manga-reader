'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ImagePlus, Loader2, Plus, Search, Trash2 } from 'lucide-react'
import { Btn as Button } from '@/components/metadata/Btn'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import ThumbEditor from '@/components/metadata/ThumbEditor'

type Result = { id: string; name: string; thumb: string; caps: number; author?: string }
type Row = { id: number; key: string; value: string }

// The fields every title should have, always shown (in this order).
const COMMON: { key: string; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'description', label: 'Sinopse', placeholder: 'Resumo da história', multiline: true },
  { key: 'categories', label: 'Tags / categorias', placeholder: 'Ação, Fantasia, Isekai (separe por vírgula)' },
  { key: 'author', label: 'Autor', placeholder: 'Nome do autor' },
  { key: 'status', label: 'Status', placeholder: 'ongoing, finished...' },
  { key: 'type', label: 'Tipo', placeholder: 'manga, manhwa, manhua' },
  { key: 'demographic', label: 'Demografia', placeholder: 'shounen, seinen...' },
  { key: 'published', label: 'Publicação', placeholder: 'jul 6, 2012 to feb 5, 2021' },
  { key: 'volumes', label: 'Volumes', placeholder: '17, ou o 1º capítulo de cada volume: 1,23,40' },
]
const COMMON_KEYS = new Set(COMMON.map((c) => c.key))
const DEBOUNCE_MS = 300

let nextRowId = 1

/**
 * Edits a title's .meta/<title>.metadata as key/value pairs: the common
 * fields up front, any custom key below, plus the cover (.thumb/<title>.jpg).
 */
export default function MetadataEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [searching, setSearching] = useState(false)
  const [title, setTitle] = useState<Result | null>(null)
  const [common, setCommon] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [editingThumb, setEditingThumb] = useState(false)
  const [thumbVersion, setThumbVersion] = useState(0)

  // Fresh state every time the modal opens.
  useEffect(() => {
    if (!open) return
    setQuery('')
    setResults([])
    setTitle(null)
    setEditingThumb(false)
    setMessage(null)
  }, [open])

  // Same search as the home's spotlight (/api/search, debounced).
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        const data = await (await fetch(`/api/search?q=${encodeURIComponent(query)}`)).json()
        setResults(Array.isArray(data) ? data : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  async function pick(r: Result) {
    setTitle(r)
    setMessage(null)
    setEditingThumb(false)
    setLoading(true)
    try {
      const { entries } = (await (await fetch(`/api/metadata/${encodeURIComponent(r.id)}/raw`)).json()) as {
        entries: [string, string][]
      }
      const c: Record<string, string> = {}
      const rows: Row[] = []
      for (const [k, v] of entries ?? []) {
        if (COMMON_KEYS.has(k)) c[k] = v
        else rows.push({ id: nextRowId++, key: k, value: v })
      }
      setCommon(c)
      setCustom(rows)
    } catch {
      setCommon({})
      setCustom([])
      setMessage({ ok: false, text: 'Não foi possível carregar os metadados.' })
    } finally {
      setLoading(false)
    }
  }

  async function save() {
    if (!title) return
    const keys = custom.map((r) => r.key.trim()).filter(Boolean)
    const bad = keys.find((k) => !/^[A-Za-z0-9_-]+$/.test(k) || COMMON_KEYS.has(k))
    if (bad) {
      setMessage({
        ok: false,
        text: COMMON_KEYS.has(bad)
          ? `"${bad}" já é um campo comum acima.`
          : `Chave inválida: "${bad}". Use letras, números, "_" ou "-".`,
      })
      return
    }
    if (new Set(keys).size !== keys.length) {
      setMessage({ ok: false, text: 'Há chaves personalizadas repetidas.' })
      return
    }
    const entries: [string, string][] = [
      ...COMMON.map((c) => [c.key, common[c.key] ?? ''] as [string, string]),
      ...custom.map((r) => [r.key.trim(), r.value] as [string, string]),
    ]
    setSaving(true)
    setMessage(null)
    const res = await fetch(`/api/metadata/${encodeURIComponent(title.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    }).catch(() => null)
    setSaving(false)
    if (!res?.ok) {
      const err = await res?.json().catch(() => null)
      setMessage({ ok: false, text: err?.error ?? 'Não foi possível salvar.' })
      return
    }
    setMessage({ ok: true, text: 'Metadados salvos.' })
  }

  const displayName = (r: Result) => r.name.replaceAll('-', ' ')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingThumb ? 'Trocar capa' : 'Metadados do título'}</DialogTitle>
        </DialogHeader>

        {!title ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2">
              {searching ? (
                <Loader2 size={18} className="animate-spin text-muted-foreground" />
              ) : (
                <Search size={18} className="text-muted-foreground" />
              )}
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por título, gênero ou autor..."
                className="w-full bg-transparent text-base placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <div className="flex max-h-[50vh] flex-col overflow-y-auto">
              {query.trim() && !searching && results.length === 0 ? (
                <p className="px-2 py-6 text-center text-sm text-muted-foreground">Nenhum título encontrado.</p>
              ) : null}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => void pick(r)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                >
                  <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded">
                    <Image src={r.thumb} alt="" fill sizes="40px" className="object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium capitalize">{displayName(r)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.caps} capítulos{r.author ? ` · ${r.author}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : editingThumb ? (
          <ThumbEditor
            title={title.id}
            onCancel={() => setEditingThumb(false)}
            onSaved={() => {
              setEditingThumb(false)
              setThumbVersion(Date.now())
              setMessage({ ok: true, text: 'Capa salva.' })
            }}
          />
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-start gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- cache-busted right after a save */}
              <img
                src={`/api/read/${encodeURIComponent(title.id)}/01/thumb${thumbVersion ? `?v=${thumbVersion}` : ''}`}
                alt=""
                className="aspect-[2/3] w-24 flex-shrink-0 rounded-md border border-border object-cover"
              />
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-xl font-bold capitalize">{displayName(title)}</p>
                <p className="text-xs text-muted-foreground">.meta/{title.id}.metadata</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMessage(null)
                      setEditingThumb(true)
                    }}
                  >
                    <ImagePlus className="mr-1.5 h-4 w-4" /> Trocar capa
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setTitle(null)}>
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Outro título
                  </Button>
                </div>
              </div>
            </div>

            {loading ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  {COMMON.map((c) => (
                    <label key={c.key} className="flex flex-col gap-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {c.label} <span className="normal-case tracking-normal opacity-60">({c.key})</span>
                      </span>
                      {c.multiline ? (
                        <textarea
                          value={common[c.key] ?? ''}
                          onChange={(e) => setCommon((s) => ({ ...s, [c.key]: e.target.value }))}
                          placeholder={c.placeholder}
                          rows={4}
                          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      ) : (
                        <Input
                          value={common[c.key] ?? ''}
                          onChange={(e) => setCommon((s) => ({ ...s, [c.key]: e.target.value }))}
                          placeholder={c.placeholder}
                        />
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex flex-col gap-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Campos personalizados</p>
                  {custom.length === 0 ? (
                    <p className="text-xs italic text-muted-foreground">Nenhum campo personalizado.</p>
                  ) : null}
                  {custom.map((r) => (
                    <div key={r.id} className="flex gap-2">
                      <Input
                        value={r.key}
                        onChange={(e) =>
                          setCustom((rows) => rows.map((x) => (x.id === r.id ? { ...x, key: e.target.value } : x)))
                        }
                        placeholder="chave"
                        className="w-40 font-mono text-xs"
                      />
                      <Input
                        value={r.value}
                        onChange={(e) =>
                          setCustom((rows) => rows.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))
                        }
                        placeholder="valor"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${r.key || 'campo'}`}
                        onClick={() => setCustom((rows) => rows.filter((x) => x.id !== r.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setCustom((rows) => [...rows, { id: nextRowId++, key: '', value: '' }])}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Adicionar campo
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">
                  Campos vazios não são gravados. Quebras de linha viram espaço (o arquivo guarda um valor por linha).
                </p>
              </>
            )}

            {message ? (
              <p className={message.ok ? 'text-sm text-emerald-400' : 'text-sm text-destructive'}>{message.text}</p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
              <Button variant="default" onClick={() => void save()} disabled={saving || loading}>
                {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </div>
          </div>
        )}

        {title && editingThumb && message ? (
          <p className={message.ok ? 'text-sm text-emerald-400' : 'text-sm text-destructive'}>{message.text}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
