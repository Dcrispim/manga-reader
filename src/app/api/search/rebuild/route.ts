import { NextResponse } from 'next/server'
import { rebuildSearchIndex } from '@/services/searchIndex'

export async function POST() {
  try {
    const { count } = await rebuildSearchIndex()
    return NextResponse.json({ count })
  } catch (error) {
    console.error('Search index rebuild failed:', error)
    return NextResponse.json({ error: 'Erro ao reconstruir índice de busca' }, { status: 500 })
  }
}
