import { NextResponse } from "next/server";
import { getXlChapterImages } from "@/services/xlSlices";

// Upscaled counterpart of /api/read/<title>/<chapter>: same { images } shape,
// with sliced pages expanded into their slice URLs. See getXlChapterImages.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string; chapter: string }> }
) {
  const { title: mangaTitle, chapter } = await params;

  try {
    const images = await getXlChapterImages(mangaTitle, chapter);
    if (!images) {
      return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ error: "Erro ao processar os arquivos" }, { status: 500 });
  }
}
