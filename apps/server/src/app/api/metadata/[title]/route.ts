import { readMetadata } from "@/services/metadata"
import { NextResponse } from "next/server"
import { stat } from "fs/promises"
import path from "path"
import { THUMB_DIR } from "@/utils/paths.server"

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
