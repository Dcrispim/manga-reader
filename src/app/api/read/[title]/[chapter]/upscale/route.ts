import { NextResponse } from 'next/server'
import { getChapterUpscaleStatus, requestChapterUpscale } from '@/services/upscale'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ title: string; chapter: string }> }
) {
  const { title, chapter } = await params
  const result = await requestChapterUpscale(title, chapter)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }
  return NextResponse.json(result)
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string; chapter: string }> }
) {
  const { title, chapter } = await params
  const result = await getChapterUpscaleStatus(title, chapter)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }
  return NextResponse.json(result)
}
