import { NextRequest, NextResponse } from 'next/server'
import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'
import type { BindData, BindPayload } from '@/utils/bind'
import { mergeBindData } from '@/utils/bind'

const ROOT_PATH = '/mnt/d/manga'
const BINDS_PATH = path.join(ROOT_PATH, '.binds')

function normalizeCode(code: string) {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function getBindPath(code: string) {
  return path.join(BINDS_PATH, `${normalizeCode(code)}.json`)
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

    // A device pushing to a code it's already bound to shouldn't get
    // permanently stranded if the bind file was deleted out from under it
    // (e.g. manually on disk) — recreate it under the same code instead of
    // 404ing forever, so already-connected devices keep syncing.
    const merged = mergeBindData(
      { history: existing?.history || {}, chapters: existing?.chapters || {} },
      { history: body.history || {}, chapters: body.chapters || {} }
    )

    const now = Date.now()
    const data: BindData = {
      code: existing?.code || normalizeCode(code),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
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
