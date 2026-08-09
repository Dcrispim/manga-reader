'use client'

import { useState } from 'react'
import { LoaderCircle, RefreshCw, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchData } from '@/services/fetch'

export default function RebuildSearchIndex() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [count, setCount] = useState<number | null>(null)

  const handleRebuild = async () => {
    setStatus('loading')
    try {
      const data = await fetchData('/api/search/rebuild', { method: 'POST' })
      if (!data || data.error) {
        setStatus('error')
        return
      }
      setCount(data.count)
      setStatus('success')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="flex flex-col w-full px-4 gap-2 mt-4">
      <Button variant="outline" onClick={handleRebuild} disabled={status === 'loading'}>
        {status === 'loading' ? (
          <LoaderCircle size={16} className="mr-2 animate-spin" />
        ) : (
          <RefreshCw size={16} className="mr-2" />
        )}
        <label>Reconstruir índice de busca</label>
      </Button>
      {status === 'success' && (
        <p className="flex items-center gap-1 text-sm text-green-500">
          <Check size={14} /> Índice atualizado ({count} títulos)
        </p>
      )}
      {status === 'error' && (
        <p className="text-sm text-destructive">Erro ao reconstruir o índice</p>
      )}
    </div>
  )
}
