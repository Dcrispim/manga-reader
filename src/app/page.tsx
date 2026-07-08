import { Suspense } from 'react'
import Home from '@/components/home/Home'

// Reads the manga library from disk at request time. Without this, Next
// treats the route as static (no dynamic APIs used) and freezes whatever
// the filesystem returned at `next build` time — which is empty inside the
// Docker build stage, since the library volume is only mounted at runtime.
export const dynamic = 'force-dynamic'

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
