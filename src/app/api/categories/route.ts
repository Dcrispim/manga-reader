import { NextResponse } from 'next/server'
import { getCategories } from '@/services/metadata'

// See src/app/page.tsx for why this is needed in Docker.
export const dynamic = 'force-dynamic'

export async function GET() {
  const categories = await getCategories()
  return NextResponse.json({ categories })
}
