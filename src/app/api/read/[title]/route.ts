import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

const ROOT_PATH = "/mnt/d/manga";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title: mangaTitle } = await params;

  try {
    // Caminho do diretório do título
    const titlePath = path.join(ROOT_PATH, mangaTitle);

    // Lê todos os diretórios dentro do título
    let chapters = await readdir(titlePath);

    // Filtra e ordena os capítulos corretamente
    const sortedChapters = chapters
      .map(chap => ({ name: chap, num: parseFloat(chap) }))
      .filter(chap => !isNaN(chap.num)) // Remove diretórios inválidos
      .sort((a, b) => a.num - b.num)
      .map(chap => chap.name); // Retorna apenas os nomes ordenados

    return NextResponse.json({ chapters: sortedChapters });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao listar capítulos" }, { status: 500 });
  }
}
