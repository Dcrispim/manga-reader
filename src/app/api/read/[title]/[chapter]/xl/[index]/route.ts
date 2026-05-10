import { NextRequest, NextResponse } from "next/server";
import path from "path";
import mime from "mime";
import { readdir, readFile } from "fs/promises";

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
  let chapters = await readdir(smallTitle);

  try{
    chapters = await readdir(titlePath);
  }catch{

  }

  const chapterDir = chapters
    .sort((a, b) => {
      const numA = parseFloat(a);
      const numB = parseFloat(b);

      if (isNaN(numA)) return 1;
      if (isNaN(numB)) return -1;

      return numA - numB;
    })
    .find((ch) => parseFloat(ch) === chapterNumber);

  if (!chapterDir) {
    return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
  }

  const chapterPath = path.join(titlePath, chapterDir);
  try {
    let files = await readdir(chapterPath);

    files = files.filter((file) => mime.getType(file)?.startsWith("image/"));

    files.sort((a, b) => {
      const nameA = path.parse(a).name;
      const nameB = path.parse(b).name;

      const numA = /^\d+$/.test(nameA) ? parseInt(nameA, 10) : Infinity;
      const numB = /^\d+$/.test(nameB) ? parseInt(nameB, 10) : Infinity;

      return numA - numB || nameA.localeCompare(nameB);
    });

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
