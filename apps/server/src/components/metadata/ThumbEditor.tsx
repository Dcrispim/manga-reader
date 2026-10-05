'use client'

import { useEffect, useRef, useState, type ClipboardEvent, type PointerEvent } from 'react'
import { ClipboardPaste, ImageUp, Link2, Loader2 } from 'lucide-react'
import { Btn as Button } from '@/components/metadata/Btn'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'

// Covers are shown in 2:3 cards everywhere (web and app); the saved file is a
// 800x1200 JPEG, a sharp size for both without being heavy.
const FRAME_W = 240
const FRAME_H = 360
const OUT_W = 800
const OUT_H = 1200

type Loaded = { src: string; w: number; h: number }

/**
 * Picks an image (link, file or clipboard), lets the user pan and zoom it in a
 * fixed 2:3 frame and saves the crop as .thumb/<title>.jpg.
 */
export default function ThumbEditor({
  title,
  onSaved,
  onCancel,
}: {
  title: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [link, setLink] = useState('')
  const [image, setImage] = useState<Loaded | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const objectUrl = useRef<string | null>(null)

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current)
  }, [])

  // Scale that makes the image just cover the frame; zoom multiplies it.
  const base = image ? Math.max(FRAME_W / image.w, FRAME_H / image.h) : 1
  const scale = base * zoom
  const iw = image ? image.w * scale : 0
  const ih = image ? image.h * scale : 0
  const clamp = (o: { x: number; y: number }) => ({
    x: Math.max(-(iw - FRAME_W) / 2, Math.min((iw - FRAME_W) / 2, o.x)),
    y: Math.max(-(ih - FRAME_H) / 2, Math.min((ih - FRAME_H) / 2, o.y)),
  })
  const pos = clamp(offset)
  const left = FRAME_W / 2 - iw / 2 + pos.x
  const top = FRAME_H / 2 - ih / 2 + pos.y

  function load(src: string, isObjectUrl = false) {
    setMessage(null)
    setBusy(true)
    const probe = new window.Image()
    probe.onload = () => {
      if (objectUrl.current && objectUrl.current !== src) URL.revokeObjectURL(objectUrl.current)
      objectUrl.current = isObjectUrl ? src : null
      setImage({ src, w: probe.naturalWidth, h: probe.naturalHeight })
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setBusy(false)
    }
    probe.onerror = () => {
      if (isObjectUrl) URL.revokeObjectURL(src)
      setMessage('Não foi possível abrir essa imagem.')
      setBusy(false)
    }
    probe.src = src
  }

  const loadBlob = (blob: Blob) => load(URL.createObjectURL(blob), true)
  const loadLink = (url: string) => load(`/api/image-proxy?url=${encodeURIComponent(url.trim())}`)

  async function pasteFromClipboard() {
    // navigator.clipboard.read needs a secure context (https or localhost);
    // on a LAN address Ctrl+V still works through onPaste below.
    if (!navigator.clipboard?.read) {
      setMessage('Use Ctrl+V nesta janela para colar a imagem.')
      return
    }
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) return loadBlob(await item.getType(type))
        if (item.types.includes('text/plain')) {
          const text = (await (await item.getType('text/plain')).text()).trim()
          if (/^https?:\/\//.test(text)) {
            setLink(text)
            return loadLink(text)
          }
        }
      }
      setMessage('A área de transferência não tem uma imagem nem um link.')
    } catch {
      setMessage('Sem permissão para ler a área de transferência. Use Ctrl+V.')
    }
  }

  function onPaste(e: ClipboardEvent) {
    const file = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'))?.getAsFile()
    if (file) {
      e.preventDefault()
      loadBlob(file)
      return
    }
    const text = e.clipboardData.getData('text').trim()
    if (/^https?:\/\//.test(text) && !(e.target instanceof HTMLInputElement)) {
      e.preventDefault()
      setLink(text)
      loadLink(text)
    }
  }

  function onPointerDown(e: PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }
  }
  function onPointerMove(e: PointerEvent) {
    const d = drag.current
    if (!d) return
    setOffset(clamp({ x: d.ox + e.clientX - d.x, y: d.oy + e.clientY - d.y }))
  }

  async function save() {
    const img = imgRef.current
    if (!img || !image) return
    setBusy(true)
    setMessage(null)
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    // The frame, mapped back to source pixels.
    ctx.drawImage(img, -left / scale, -top / scale, FRAME_W / scale, FRAME_H / scale, 0, 0, OUT_W, OUT_H)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.9))
    if (!blob) {
      setBusy(false)
      setMessage('Não foi possível gerar a imagem.')
      return
    }
    const res = await fetch(`/api/thumb/${encodeURIComponent(title)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/jpeg' },
      body: blob,
    }).catch(() => null)
    setBusy(false)
    if (!res?.ok) {
      const err = await res?.json().catch(() => null)
      setMessage(err?.error ?? 'Não foi possível salvar a capa.')
      return
    }
    onSaved()
  }

  return (
    <div className="flex flex-col gap-4" onPaste={onPaste}>
      <div className="flex flex-col gap-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (link.trim()) loadLink(link)
          }}
        >
          <div className="relative flex-1">
            <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link da imagem (https://...)"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline" disabled={!link.trim() || busy}>
            Carregar
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <ImageUp className="mr-1.5 h-4 w-4" /> Escolher arquivo
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) loadBlob(f)
                  e.target.value = ''
                }}
              />
            </label>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void pasteFromClipboard()}>
            <ClipboardPaste className="mr-1.5 h-4 w-4" /> Colar da área de transferência
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Também dá para colar uma imagem ou link com Ctrl+V aqui.</p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          className="relative overflow-hidden rounded-md border border-border bg-secondary touch-none select-none"
          style={{ width: FRAME_W, height: FRAME_H, cursor: image ? 'grab' : 'default' }}
          onPointerDown={image ? onPointerDown : undefined}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onWheel={(e) => image && setZoom((z) => Math.min(4, Math.max(1, z - e.deltaY * 0.001)))}
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob/proxy source drawn into a canvas
            <img
              ref={imgRef}
              src={image.src}
              alt=""
              draggable={false}
              className="absolute max-w-none pointer-events-none"
              style={{ width: iw, height: ih, left, top }}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Escolha uma imagem para recortar no formato da capa (2:3).'}
            </div>
          )}
        </div>
        {image ? (
          <div className="flex w-[240px] items-center gap-3">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Slider className="w-full" min={1} max={4} step={0.01} value={[zoom]} onValueChange={([z]) => setZoom(z)} />
          </div>
        ) : null}
        {image ? <p className="text-xs text-muted-foreground">Arraste para posicionar.</p> : null}
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button variant="default" onClick={() => void save()} disabled={!image || busy}>
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Salvar capa
        </Button>
      </div>
    </div>
  )
}
