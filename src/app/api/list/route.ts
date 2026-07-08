import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";

const ROOT_PATH = "/mnt/d/manga";

// See src/app/page.tsx for why this is needed in Docker.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Lê todos os diretórios no caminho raiz
    const titles = await readdir(ROOT_PATH, { withFileTypes: true });

    // Filtra apenas diretórios e retorna seus detalhes
    const titleList = await Promise.all(
      titles
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith("."))
        .map(async dirent => {
          const caps = await readdir(path.join(ROOT_PATH, dirent.name), { withFileTypes: true });
          return {
            name: dirent.name,
            thumb: `/api/read/${dirent.name}/01/thumb`,
            description: `Description for ${dirent.name}`, // Placeholder description
            caps: caps.length, // Placeholder caps count
            link: `/read/${dirent.name.toLowerCase().replace(/\s+/g, "-")}`,
          };
        })
    );

    return NextResponse.json(titleList);
  } catch (error) {
    return NextResponse.json({ error: "Erro ao listar títulos" }, { status: 500 });
  }
}
