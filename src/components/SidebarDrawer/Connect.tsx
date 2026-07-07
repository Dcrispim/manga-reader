'use client'

import { useState } from 'react'
import { Check, CloudDownload, CloudUpload, Copy, LoaderCircle, Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import i18n from '@/services/i18n'
import { fetchData } from '@/services/fetch'
import { getChapters, getHistory, setChapters, setHistory } from '@/utils/history'
import { BIND_CODE_KEY, BindData, mergeBindData } from '@/utils/bind'

export default function Connect() {
  const [syncUpOpen, setSyncUpOpen] = useState(false)
  const [syncUpLoading, setSyncUpLoading] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [syncInOpen, setSyncInOpen] = useState(false)
  const [syncInLoading, setSyncInLoading] = useState(false)
  const [inputCode, setInputCode] = useState('')
  const [syncInStatus, setSyncInStatus] = useState<'idle' | 'error' | 'success'>('idle')

  const handleSyncUpOpen = async (open: boolean) => {
    setSyncUpOpen(open)
    if (!open) return

    setCopied(false)
    const existingCode = localStorage.getItem(BIND_CODE_KEY)
    if (existingCode) {
      setCode(existingCode)
      return
    }

    setSyncUpLoading(true)
    try {
      const data = await fetchData('/api/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history: getHistory(), chapters: getChapters() }),
      })

      if (data && !data.error) {
        localStorage.setItem(BIND_CODE_KEY, (data as BindData).code)
        setCode((data as BindData).code)
      }
    } finally {
      setSyncUpLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSyncInOpen = (open: boolean) => {
    setSyncInOpen(open)
    if (!open) {
      setInputCode('')
      setSyncInStatus('idle')
    }
  }

  const handleSyncIn = async () => {
    const normalizedCode = inputCode.trim().toUpperCase()
    if (!normalizedCode) return

    setSyncInLoading(true)
    setSyncInStatus('idle')
    try {
      const remote = await fetchData(`/api/bind/${normalizedCode}`)

      if (!remote || remote.error) {
        setSyncInStatus('error')
        return
      }

      const merged = mergeBindData(
        { history: getHistory(), chapters: getChapters() },
        { history: (remote as BindData).history, chapters: (remote as BindData).chapters }
      )
      setHistory(merged.history)
      setChapters(merged.chapters)
      localStorage.setItem(BIND_CODE_KEY, normalizedCode)
      setSyncInStatus('success')
    } catch {
      setSyncInStatus('error')
    } finally {
      setSyncInLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center w-full px-4 gap-2 mt-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground w-full">
        <Link2 size={16} />
        <span>{i18n('Connect')}</span>
      </div>

      <Dialog open={syncUpOpen} onOpenChange={handleSyncUpOpen}>
        <DialogTrigger asChild>
          <Button className="w-full" variant="outline">
            <CloudUpload size={16} className="mr-2" />
            <label>{i18n('Sync Up')}</label>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{i18n('Sync Up')}</DialogTitle>
            <DialogDescription>{i18n('Sync Up description')}</DialogDescription>
          </DialogHeader>
          {syncUpLoading || !code ? (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <LoaderCircle size={18} className="animate-spin" />
              <span>{i18n('Generating')}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Input readOnly value={code} className="text-center text-lg font-mono tracking-widest" />
              <Button variant="outline" className="w-auto px-3" onClick={handleCopy}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={syncInOpen} onOpenChange={handleSyncInOpen}>
        <DialogTrigger asChild>
          <Button className="w-full" variant="outline">
            <CloudDownload size={16} className="mr-2" />
            <label>{i18n('Sync In')}</label>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{i18n('Sync In')}</DialogTitle>
            <DialogDescription>{i18n('Sync In description')}</DialogDescription>
          </DialogHeader>
          <Input
            placeholder={i18n('Enter code') as string}
            value={inputCode}
            onChange={(e) => setInputCode(e.target.value.toUpperCase())}
            className="text-center text-lg font-mono tracking-widest"
            maxLength={6}
          />
          {syncInStatus === 'error' && (
            <p className="text-sm text-destructive">{i18n('Sync error')}</p>
          )}
          {syncInStatus === 'success' && (
            <p className="text-sm text-green-500">{i18n('Sync success')}</p>
          )}
          <DialogFooter>
            <Button onClick={handleSyncIn} disabled={syncInLoading || !inputCode.trim()}>
              {syncInLoading ? (
                <LoaderCircle size={16} className="mr-2 animate-spin" />
              ) : (
                <CloudDownload size={16} className="mr-2" />
              )}
              <label>{syncInLoading ? i18n('Connecting') : i18n('Sync In')}</label>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
