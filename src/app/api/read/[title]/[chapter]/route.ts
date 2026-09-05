import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import mime from "mime";
import { resolveChapterDir } from "@/utils/chapterDir.server";

// Defina o caminho raiz onde os mangás estão armazenados
const ROOT_PATH = "/mnt/d/manga";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string,chapter:string }> }
) {
  const { title: mangaTitle, chapter } = await params;
  const chapterNumber = parseFloat(chapter);

  try {
    // Caminho da pasta do mangá
    const titlePath = path.join(ROOT_PATH, mangaTitle);

    // Pega o diretório do capítulo correspondente ao número
    const chapterDir = await resolveChapterDir(titlePath, chapterNumber);
    if (!chapterDir) {
      return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
    }

    // Caminho final do capítulo
    const chapterPath = path.join(titlePath, chapterDir);

    // Lista todos os arquivos do capítulo
    let files = await readdir(chapterPath);

    // Filtra apenas imagens e ordena corretamente
    const imageFiles = files
      .filter(file => mime.getType(file)?.startsWith("image/"))
      .sort((a, b) => {
        const nameA = path.parse(a).name;
        const nameB = path.parse(b).name;

        const numA = /^\d+$/.test(nameA) ? parseInt(nameA, 10) : Infinity;
        const numB = /^\d+$/.test(nameB) ? parseInt(nameB, 10) : Infinity;

        return numA - numB || nameA.localeCompare(nameB);
      });

    // Retorna a lista dos caminhos completos das imagens
    const imagePaths = imageFiles.map((_, i) => `/api/read/${mangaTitle}/${chapterNumber}/${i}`);

    return NextResponse.json({ images: imagePaths });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao processar os arquivos" }, { status: 500 });
  }
}