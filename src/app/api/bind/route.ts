import { NextRequest, NextResponse } from 'next/server'
import { access, mkdir, writeFile } from 'fs/promises'
import path from 'path'
import type { BindData, BindPayload } from '@/utils/bind'

const ROOT_PATH = '/mnt/d/manga'
const BINDS_PATH = path.join(ROOT_PATH, '.binds')
const CODE_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 6

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[Math.floor(Math.random() * CODE_CHARSET.length)]
  }
  return code
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: Partial<BindPayload> = await request.json().catch(() => ({}))

    await mkdir(BINDS_PATH, { recursive: true })

    let code = generateCode()
    let filePath = path.join(BINDS_PATH, `${code}.json`)
    let attempts = 0
    while ((await fileExists(filePath)) && attempts < 10) {
      code = generateCode()
      filePath = path.join(BINDS_PATH, `${code}.json`)
      attempts++
    }

    const now = Date.now()
    const data: BindData = {
      code,
      createdAt: now,
      updatedAt: now,
      history: body.history || {},
      chapters: body.chapters || {},
    }

    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao criar código de conexão' }, { status: 500 })
  }
}
