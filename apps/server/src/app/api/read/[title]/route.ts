import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
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

    // Filtra diretórios inválidos e agrupa por número (ex.: "566" e "0566" são o mesmo capítulo)
    const byNum = new Map<number, string>();
    const pageCount = new Map<string, number>();
    for (const chap of chapters) {
      const num = parseFloat(chap);
      if (isNaN(num)) continue;

      const current = byNum.get(num);
      if (!current) {
        byNum.set(num, chap);
        continue;
      }

      // Duplicata numérica: mantém o diretório com mais páginas (mais completo)
      if (!pageCount.has(current)) {
        pageCount.set(current, (await readdir(path.join(titlePath, current))).length);
      }
      if (!pageCount.has(chap)) {
        pageCount.set(chap, (await readdir(path.join(titlePath, chap))).length);
      }
      if ((pageCount.get(chap) ?? 0) > (pageCount.get(current) ?? 0)) {
        byNum.set(num, chap);
      }
    }

    // Ordena os capítulos numericamente únicos
    const sortedChapters = [...byNum.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, name]) => name);

    const modified: Record<string, number> = {};
    await Promise.all(
      sortedChapters.map(async (chap) => {
        try {
          const stats = await stat(path.join(titlePath, chap));
          modified[chap] = stats.mtimeMs;
        } catch {
          // dir vanished mid-scan — leave it out of the map
        }
      })
    );

    return NextResponse.json({ chapters: sortedChapters, modified });
  } catch (error) {
    return NextResponse.json({ error: "Erro ao listar capítulos" }, { status: 500 });
  }
}
