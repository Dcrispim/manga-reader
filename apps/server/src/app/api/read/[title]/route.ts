import { NextResponse } from "next/server";
import { readdir, stat } from "fs/promises";
import path from "path";
import { chapterNumber, pickChapterDirs, sortedChapterNumbers } from "@manga/core";
import { MANGA_ROOT } from "@/utils/paths.server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ title: string }> }
) {
  const { title: mangaTitle } = await params;

  try {
    // Caminho do diretório do título
    const titlePath = path.join(MANGA_ROOT, mangaTitle);

    // Lê todos os diretórios dentro do título
    let chapters = await readdir(titlePath);

    // Group by chapter number ("566" and "0566" are the same chapter); the
    // core picks the fullest folder. Only duplicated numbers need a file count.
    const numCounts = new Map<number, number>();
    for (const chap of chapters) {
      const num = chapterNumber(chap);
      if (num !== null) numCounts.set(num, (numCounts.get(num) ?? 0) + 1);
    }
    const entries: { name: string; fileCount: number }[] = [];
    for (const chap of chapters) {
      const num = chapterNumber(chap);
      if (num === null) continue;
      const fileCount =
        (numCounts.get(num) ?? 0) > 1
          ? (await readdir(path.join(titlePath, chap))).length
          : 0;
      entries.push({ name: chap, fileCount });
    }
    const byNum = pickChapterDirs(entries);
    const sortedChapters = sortedChapterNumbers(byNum).map((n) => byNum.get(n)!);

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
