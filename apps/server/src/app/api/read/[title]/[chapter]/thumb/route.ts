import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import mime from "mime";
import { sortImageFiles } from "@manga/core";
import { resolveChapterDir } from "@/utils/chapterDir.server";
import { MANGA_ROOT, THUMB_DIR } from "@/utils/paths.server";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ title: string,chapter:string }> }
  ) {
    const { title: mangaTitle, chapter } = await params;
    const chapterNumber = parseFloat(chapter);
    const titlePath = path.join(MANGA_ROOT, mangaTitle);

    try {
        // Check for thumbnail at THUMB_DIR/[title].jpg
        const thumbPath = path.join(THUMB_DIR,`${mangaTitle}.jpg`);
        try {
            const thumbBuffer = await readFile(thumbPath);
            const thumbMimeType = mime.getType(thumbPath) || "application/octet-stream";

            return new NextResponse(thumbBuffer, {
                status: 200,
                headers: {
                    "Content-Type": thumbMimeType,
                    "Content-Length": thumbBuffer.length.toString(),
                },
            });
        } catch {
            // Thumbnail not found, proceed to fetch the first image from the chapter
        }

        const chapterDir = await resolveChapterDir(titlePath, chapterNumber);
        if (!chapterDir) {
            return NextResponse.json({ error: "Capítulo não encontrado" }, { status: 404 });
        }
        const chapterPath = path.join(titlePath, chapterDir);
        try {
            // Lista todos os arquivos na pasta do capítulo
            let files = await readdir(chapterPath);

            // Images only, in reading order (rules live in the core)
            files = sortImageFiles(files);

            // Obtém o primeiro arquivo de imagem
            if (files.length === 0) {
                return NextResponse.json({ error: "Nenhuma imagem encontrada" }, { status: 400 });
            }

            const filePath = path.join(chapterPath, files[0]);
            const fileBuffer = await readFile(filePath);
            const mimeType = mime.getType(filePath) || "application/octet-stream";

            // Retorna a imagem diretamente no response
            return new NextResponse(fileBuffer, {
                status: 200,
                headers: {
                    "Content-Type": mimeType,
                    "Content-Length": fileBuffer.length.toString(),
                },
            });
        } catch {
            return NextResponse.json({ error: "Erro ao processar a imagem" }, { status: 500 });
        }
    } catch {
        return NextResponse.json({ error: "Erro ao processar a imagem" }, { status: 500 });
    }
}
