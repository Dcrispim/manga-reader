import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { BindData, BindPayload } from '@/utils/bind'
import { mergeBindData } from '@/utils/bind'

const ROOT_PATH = '/mnt/d/manga'
const BINDS_PATH = path.join(ROOT_PATH, '.binds')

function getBindPath(code: string) {
  const safeCode = code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return path.join(BINDS_PATH, `${safeCode}.json`)
}

async function readBind(code: string): Promise<BindData | null> {
  try {
    const content = await readFile(getBindPath(code), 'utf-8')
    return JSON.parse(content) as BindData
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params
  const bind = await readBind(code)

  if (!bind) {
    return NextResponse.json({ error: 'Código não encontrado' }, { status: 404 })
  }

  return NextResponse.json(bind)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params
    const body: Partial<BindPayload> = await request.json().catch(() => ({}))
    const existing = await readBind(code)

    if (!existing) {
      return NextResponse.json({ error: 'Código não encontrado' }, { status: 404 })
    }

    const merged = mergeBindData(
      { history: existing.history, chapters: existing.chapters },
      { history: body.history || {}, chapters: body.chapters || {} }
    )

    const data: BindData = {
      code: existing.code,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
      history: merged.history,
      chapters: merged.chapters,
    }

    await mkdir(BINDS_PATH, { recursive: true })
    await writeFile(getBindPath(code), JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar conexão' }, { status: 500 })
  }
}
