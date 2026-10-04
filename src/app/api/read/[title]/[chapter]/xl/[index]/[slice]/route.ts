import { NextRequest, NextResponse } from "next/server";
import path from "path";
import mime from "mime";
import { readFile } from "fs/promises";
import { resolveChapterDir } from "@/utils/chapterDir.server";
import { SLICES_PER_PAGE, listSortedImages, slicePath } from "@/services/xlSlices";

const ROOT_PATH = "/mnt/d/manga-xl";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ title: string; chapter: string; index: string; slice: string }> }
) {
  const { title: mangaTitle, chapter, index: indexPage, slice: sliceParam } = await params;
  const chapterNumber = parseFloat(chapter);

  const titlePath = path.join(ROOT_PATH, mangaTitle);
  const chapterDir = await resolveChapterDir(titlePath, chapterNumber);
  if (!chapterDir) {
    return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
  }

  const chapterPath = path.join(titlePath, chapterDir);
  const files = await listSortedImages(chapterPath);

  const index = parseInt(indexPage, 10);
  const slice = parseInt(sliceParam, 10);
  if (isNaN(index) || index < 0 || index >= files.length || isNaN(slice) || slice < 0 || slice >= SLICES_PER_PAGE) {
    return NextResponse.json({ error: "Página fora do limite" }, { status: 400 });
  }

  const filePath = slicePath(chapterPath, files[index], slice);
  try {
    const fileBuffer = await readFile(filePath);
    const mimeType = mime.getType(filePath) || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Fatia não encontrada" }, { status: 404 });
  }
}
