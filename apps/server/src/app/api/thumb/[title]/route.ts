import { mkdir, rename, writeFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { THUMB_DIR } from "@/utils/paths.server"
import { isExistingTitle } from "@/utils/titleGuard.server"

const MAX_BYTES = 5 * 1024 * 1024

// Saves an already cropped JPEG as .thumb/<title>.jpg (the curated cover).
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params
  if (!(await isExistingTitle(title))) {
    return NextResponse.json({ error: "Título não encontrado" }, { status: 404 })
  }
  const bytes = Buffer.from(await req.arrayBuffer())
  // JPEG files start with FF D8 FF; the editor always exports JPEG.
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    return NextResponse.json({ error: "Envie uma imagem JPEG" }, { status: 400 })
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem maior que 5 MB" }, { status: 413 })
  }
  try {
    await mkdir(THUMB_DIR, { recursive: true })
    const dest = path.join(THUMB_DIR, `${title}.jpg`)
    const tmp = `${dest}.tmp`
    await writeFile(tmp, bytes)
    await rename(tmp, dest)
  } catch (error) {
    console.error("Thumb write failed:", error)
    return NextResponse.json({ error: "Não foi possível salvar a capa" }, { status: 500 })
  }
  return NextResponse.json({ ok: true, bytes: bytes.length })
}
