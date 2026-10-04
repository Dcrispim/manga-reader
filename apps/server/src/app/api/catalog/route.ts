import { NextResponse } from 'next/server'
import { buildCatalog } from '@/services/catalog.server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('since'))
  // Missing or invalid `since` means "give me everything".
  const since = Number.isFinite(raw) && raw > 0 ? raw : 0
  try {
    return NextResponse.json(await buildCatalog(since), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Internal error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
