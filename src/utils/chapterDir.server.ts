import { readdir } from "fs/promises";
import path from "path";

// Vários downloads podem gerar pastas diferentes para o mesmo capítulo
// (ex.: "566" e "0566"). Resolve para a pasta com mais páginas, que é a
// mais completa, mantendo a escolha consistente entre as rotas de leitura.
export const resolveChapterDir = async (
  titlePath: string,
  chapterNumber: number
): Promise<string | null> => {
  const entries = await readdir(titlePath).catch(() => []);
  let best: string | null = null;
  let bestPageCount = -1;

  for (const entry of entries) {
    if (parseFloat(entry) !== chapterNumber) continue;

    const pageCount = await readdir(path.join(titlePath, entry))
      .then((files) => files.length)
      .catch(() => 0);

    if (pageCount > bestPageCount) {
      best = entry;
      bestPageCount = pageCount;
    }
  }

  return best;
};
