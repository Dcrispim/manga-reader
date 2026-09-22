'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { HardDrive } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  DEFAULT_MAX_GLOBAL,
  DEFAULT_MAX_PER_TITLE,
  getDownloadHighRes,
  getMaxGlobal,
  getMaxPerTitle,
  setDownloadHighRes,
  setMaxGlobal,
  setMaxPerTitle,
} from '@/utils/offline/config'

export default function OfflineLimitsSettings() {
  const [perTitle, setPerTitle] = useState(DEFAULT_MAX_PER_TITLE)
  const [global, setGlobal] = useState(DEFAULT_MAX_GLOBAL)
  const [highRes, setHighRes] = useState(false)

  useEffect(() => {
    setPerTitle(getMaxPerTitle())
    setGlobal(getMaxGlobal())
    setHighRes(getDownloadHighRes())
  }, [])

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-border">
      <p className="text-sm font-medium">Leitura offline</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <Label htmlFor="max-per-title" className="text-xs text-muted-foreground">
            Máx. capítulos por título
          </Label>
          <Input
            id="max-per-title"
            type="number"
            min={1}
            value={perTitle}
            onChange={(e) => {
              const value = Math.max(1, parseInt(e.target.value, 10) || DEFAULT_MAX_PER_TITLE)
              setPerTitle(value)
              setMaxPerTitle(value)
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="max-global" className="text-xs text-muted-foreground">
            Máx. capítulos no total
          </Label>
          <Input
            id="max-global"
            type="number"
            min={1}
            value={global}
            onChange={(e) => {
              const value = Math.max(1, parseInt(e.target.value, 10) || DEFAULT_MAX_GLOBAL)
              setGlobal(value)
              setMaxGlobal(value)
            }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="download-high-res" className="text-xs text-muted-foreground text-left">
          Baixar em alta resolução quando disponível
        </Label>
        <Switch
          id="download-high-res"
          checked={highRes}
          onCheckedChange={(value) => {
            setHighRes(value)
            setDownloadHighRes(value)
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Secundário: o download sempre salva a versão original primeiro; se disponível, a versão em
        alta resolução (upscale) é buscada depois, em segundo plano, e substitui as páginas quando
        pronta.
      </p>
      <Link href="/offline/manage" className="w-full">
        <Button variant="outline" className="w-full">
          <HardDrive className="w-4 h-4 mr-2" />
          Gerenciar arquivos locais
        </Button>
      </Link>
    </div>
  )
}
