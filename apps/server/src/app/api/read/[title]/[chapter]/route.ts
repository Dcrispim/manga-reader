import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import { sortImageFiles } from "@manga/core";
import { resolveChapterDir } from "@/utils/chapterDir.server";
import { MANGA_ROOT } from "@/utils/paths.server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string,chapter:string }> }
) {
  const { title: mangaTitle, chapter } = await params;
  const chapterNumber = parseFloat(chapter);

  try {
    // Caminho da pasta do mangá
    const titlePath = path.join(MANGA_ROOT, mangaTitle);

    // Pega o diretório do capítulo correspondente ao número
    const chapterDir = await resolveChapterDir(titlePath, chapterNumber);
    if (!chapterDir) {
      return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
    }

    // Caminho final do capítulo
    const chapterPath = path.join(titlePath, chapterDir);

    // Lista todos os arquivos do capítulo
    const files = await readdir(chapterPath);

    // Filter images and order them (rules live in the core)
    const imageFiles = sortImageFiles(files);

    // Retorna a lista dos caminhos completos das imagens
    const imagePaths = imageFiles.map((_, i) => `/api/read/${mangaTitle}/${chapterNumber}/${i}`);

    return NextResponse.json({ images: imagePaths });
  } catch {
    return NextResponse.json({ error: "Erro ao processar os arquivos" }, { status: 500 });
  }
}