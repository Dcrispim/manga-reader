import { NextResponse } from "next/server"
import { isExistingTitle } from "@/utils/titleGuard.server"
import { downloadArgs, startTitleDownload } from "@/services/titleDownload"

type Ctx = { params: Promise<{ title: string }> }

// Starts `manga-download <title> <template> [start end] [--gaps] [--update]` and answers
// 202 right away; the run refreshes the stats json when it finishes.
export async function POST(req: Request, { params }: Ctx) {
  const { title } = await params
  if (!(await isExistingTitle(title))) {
    return NextResponse.json({ error: "Título não encontrado" }, { status: 404 })
  }
  const args = downloadArgs(await req.json().catch(() => null))
  if (typeof args === "string") {
    return NextResponse.json({ error: args }, { status: 400 })
  }
  const result = await startTitleDownload(title, args)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ started: true, args }, { status: 202 })
}
