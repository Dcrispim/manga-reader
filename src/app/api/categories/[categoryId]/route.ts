import { NextResponse, NextRequest } from 'next/server'
import { getTitlesByCategory } from '@/services/metadata'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params
  const titles = await getTitlesByCategory(categoryId)
  return NextResponse.json({ titles })
}
