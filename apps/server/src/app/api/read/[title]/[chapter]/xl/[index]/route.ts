import { NextRequest, NextResponse } from "next/server";
import path from "path";
import mime from "mime";
import { resolveChapterDir } from "@/utils/chapterDir.server";
import { listSortedImages, readPage } from "@/services/xlSlices";

const ROOT_PATH = "/mnt/d/manga-xl";
const ROOT_PATH_SMALL = "/mnt/d/manga";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ title: string,chapter:string, index:string }> }
) {
  const { title: mangaTitle, chapter, index:indexPage } = await params;
  const chapterNumber = parseFloat(chapter);

  const titlePath = path.join(ROOT_PATH, mangaTitle);
  const smallTitle = path.join(ROOT_PATH_SMALL, mangaTitle);

  let chapterRoot = titlePath;
  let chapterDir = await resolveChapterDir(titlePath, chapterNumber);
  if (!chapterDir) {
    chapterRoot = smallTitle;
    chapterDir = await resolveChapterDir(smallTitle, chapterNumber);
  }

  if (!chapterDir) {
    return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
  }

  const chapterPath = path.join(chapterRoot, chapterDir);
  try {
    // Sliced xl pages no longer have their full file — listSortedImages still
    // lists them, and readPage stitches them back together.
    const files = await listSortedImages(chapterPath);

    const index = parseInt(indexPage, 10);
    if (isNaN(index) || index < 0 || index >= files.length) {
      return NextResponse.json({ error: "Página fora do limite" }, { status: 400 });
    }

    const filePath = path.join(chapterPath, files[index]);
    const fileBuffer = await readPage(chapterPath, files[index]);
    const mimeType = mime.getType(filePath) || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao processar a imagem" }, { status: 500 });
  }
}
