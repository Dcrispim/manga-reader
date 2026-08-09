import { readMetadata } from "@/services/metadata"
import { NextResponse } from "next/server"
import { stat } from "fs/promises"
import path from "path"

const ROOT_PATH = "/mnt/d/manga"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title } = await params
  const metadata = await readMetadata(title)

  const thumbSource = await stat(path.join(ROOT_PATH, ".thumb", `${title}.jpg`))
    .then(() => "curated" as const)
    .catch(() => "crop" as const)

  return NextResponse.json({ ...metadata, thumbSource })
}
