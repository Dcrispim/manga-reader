import { NextResponse } from 'next/server'
import { getCategories } from '@/services/metadata'

export async function GET() {
  const categories = await getCategories()
  return NextResponse.json({ categories })
}
