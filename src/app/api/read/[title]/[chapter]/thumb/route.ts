import { NextResponse } from "next/server";
import { readFile, readdir } from "fs/promises";
import path from "path";
import mime from "mime";

// Defina o caminho raiz onde os mangás estão armazenados
const ROOT_PATH = "/mnt/d/manga";

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ title: string,chapter:string }> }
  ) {
    const { title: mangaTitle, chapter } = await params;
    const chapterNumber = parseFloat(chapter);
    const titlePath = path.join(ROOT_PATH, mangaTitle);

    try {
        // Check for thumbnail at ROOT_PATH/[title].jpg
        const thumbPath = path.join(ROOT_PATH, ".thumb",`${mangaTitle}.jpg`);
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

        const chapters = await readdir(titlePath);
        const chapterDir = chapters.sort((a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);

            if (isNaN(numA)) return 1;
            if (isNaN(numB)) return -1;

            return numA - numB;
        }).find(ch => parseFloat(ch) === chapterNumber);
        const chapterPath = path.join(titlePath, chapterDir!);
        try {
            // Lista todos os arquivos na pasta do capítulo
            let files = await readdir(chapterPath);

            // Filtra apenas arquivos de imagem
            files = files.filter(file => mime.getType(file)?.startsWith("image/"));

            // Ordena os arquivos considerando números puros primeiro
            files.sort((a, b) => {
                const nameA = path.parse(a).name;
                const nameB = path.parse(b).name;

                const numA = /^\d+$/.test(nameA) ? parseInt(nameA, 10) : Infinity;
                const numB = /^\d+$/.test(nameB) ? parseInt(nameB, 10) : Infinity;

                return numA - numB || nameA.localeCompare(nameB);
            });

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
        } catch (error) {
            return NextResponse.json({ error: "Erro ao processar a imagem" }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ error: "Erro ao processar a imagem" }, { status: 500 });
    }
}
