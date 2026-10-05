import { readFile } from "fs/promises"
import path from "path"
import { NextResponse } from "next/server"
import { parseMetadataEntries } from "@manga/core"
import { META_DIR } from "@/utils/paths.server"
import { isExistingTitle } from "@/utils/titleGuard.server"

// The .metadata file as editable key/value pairs (custom keys included).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params
  if (!(await isExistingTitle(title))) {
    return NextResponse.json({ error: "Título não encontrado" }, { status: 404 })
  }
  const content = await readFile(path.join(META_DIR, `${title}.metadata`), "utf-8").catch(() => "")
  return NextResponse.json({ entries: parseMetadataEntries(content) })
}
