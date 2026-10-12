import { NextResponse } from "next/server"
import { isExistingTitle } from "@/utils/titleGuard.server"
import { readTitleStats, refreshTitleStats } from "@/services/titleStats"

type Ctx = { params: Promise<{ title: string }> }

// The <title>_stats.json manga-stats leaves in the title folder (gaps,
// chapters below average, per-chapter counts).
export async function GET(_req: Request, { params }: Ctx) {
  const { title } = await params
  if (!(await isExistingTitle(title))) {
    return NextResponse.json({ error: "Título não encontrado" }, { status: 404 })
  }
  const stats = await readTitleStats(title)
  if (!stats) {
    return NextResponse.json({ error: "Status ainda não gerado" }, { status: 404 })
  }
  return NextResponse.json(stats)
}

// Re-runs `manga-stats <title>` and answers with the fresh JSON.
export async function POST(_req: Request, { params }: Ctx) {
  const { title } = await params
  if (!(await isExistingTitle(title))) {
    return NextResponse.json({ error: "Título não encontrado" }, { status: 404 })
  }
  const result = await refreshTitleStats(title)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }
  const stats = await readTitleStats(title)
  if (!stats) {
    return NextResponse.json({ error: "manga-stats terminou sem gerar o JSON" }, { status: 500 })
  }
  return NextResponse.json(stats)
}
