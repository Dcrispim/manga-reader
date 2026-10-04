import { readdir } from "fs/promises";
import path from "path";
import { pickChapterDirs } from "@manga/core";

// Vários downloads podem gerar pastas diferentes para o mesmo capítulo
// (ex.: "566" e "0566"). Resolve para a pasta com mais páginas, que é a
// mais completa, mantendo a escolha consistente entre as rotas de leitura.
// Only I/O (listing/counting) happens here; the choice is made by the core.
export const resolveChapterDir = async (
  titlePath: string,
  chapterNumberWanted: number
): Promise<string | null> => {
  const names = await readdir(titlePath).catch(() => []);
  const entries: { name: string; fileCount: number }[] = [];

  for (const name of names) {
    if (parseFloat(name) !== chapterNumberWanted) continue;
    const fileCount = await readdir(path.join(titlePath, name))
      .then((files) => files.length)
      .catch(() => 0);
    entries.push({ name, fileCount });
  }

  return pickChapterDirs(entries).get(chapterNumberWanted) ?? null;
};
