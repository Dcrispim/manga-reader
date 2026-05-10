import { Suspense } from 'react'
import Home from '@/components/home/Home'

function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="animate-pulse text-white text-xl">Carregando...</div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <Home />
    </Suspense>
  )
}
