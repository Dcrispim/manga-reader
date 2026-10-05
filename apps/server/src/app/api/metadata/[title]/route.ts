import { readMetadata } from "@/services/metadata"
import { rebuildSearchIndex } from "@/services/searchIndex"
import { NextResponse } from "next/server"
import { mkdir, rename, stat, writeFile } from "fs/promises"
import path from "path"
import { parseMetadataFile, serializeMetadataEntries, type MetadataEntry } from "@manga/core"
import { META_DIR, THUMB_DIR } from "@/utils/paths.server"
import { isExistingTitle } from "@/utils/titleGuard.server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params
  const metadata = await readMetadata(title)

  const thumbSource = await stat(path.join(THUMB_DIR, `${title}.jpg`))
    .then(() => "curated" as const)
    .catch(() => "crop" as const)

  return NextResponse.json({ ...metadata, thumbSource })
}

// Saves the editor's key/value pairs as .meta/<title>.metadata (atomic write),
// then refreshes the search index so the new author/tags are searchable.
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params
  if (!(await isExistingTitle(title))) {
    return NextResponse.json({ error: "Título não encontrado" }, { status: 404 })
  }
  let entries: MetadataEntry[]
  try {
    const body = await req.json()
    entries = body?.entries
    if (!Array.isArray(entries) || !entries.every((e) => Array.isArray(e) && e.length === 2 && e.every((x) => typeof x === "string"))) {
      throw new Error("bad entries")
    }
  } catch {
    return NextResponse.json({ error: "Formato inválido: { entries: [[chave, valor], ...] }" }, { status: 400 })
  }

  const text = serializeMetadataEntries(entries)
  try {
    await mkdir(META_DIR, { recursive: true })
    const dest = path.join(META_DIR, `${title}.metadata`)
    const tmp = `${dest}.tmp`
    await writeFile(tmp, text, "utf-8")
    await rename(tmp, dest)
  } catch (error) {
    console.error("Metadata write failed:", error)
    return NextResponse.json({ error: "Não foi possível salvar os metadados" }, { status: 500 })
  }
  await rebuildSearchIndex().catch((error) => console.error("Search index rebuild failed:", error))
  return NextResponse.json(parseMetadataFile(text))
}
