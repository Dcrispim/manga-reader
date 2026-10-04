import { NextRequest, NextResponse } from "next/server";
import path from "path";
import mime from "mime";
import { readdir, readFile } from "fs/promises";
import { sortImageFiles } from "@manga/core";
import { resolveChapterDir } from "@/utils/chapterDir.server";
import { MANGA_ROOT } from "@/utils/paths.server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ title: string,chapter:string, index:string }> }
) {
  const { title: mangaTitle, chapter, index:indexPage } = await params;
  const chapterNumber = parseFloat(chapter);

  const titlePath = path.join(MANGA_ROOT, mangaTitle);
  const chapterDir = await resolveChapterDir(titlePath, chapterNumber);

  if (!chapterDir) {
    return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
  }

  const chapterPath = path.join(titlePath, chapterDir);
  try {
    let files = await readdir(chapterPath);

    files = sortImageFiles(files);

    const index = parseInt(indexPage, 10);
    if (isNaN(index) || index < 0 || index >= files.length) {
      return NextResponse.json({ error: "Página fora do limite" }, { status: 400 });
    }

    const filePath = path.join(chapterPath, files[index]);
    const fileBuffer = await readFile(filePath);
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
