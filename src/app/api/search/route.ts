import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import Fuse from "fuse.js";

const ROOT_PATH = "/mnt/d/manga";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';
    
    // Read all directories in root path
    const titles = await readdir(ROOT_PATH, { withFileTypes: true });

    // Get all manga with basic info
    const titleList = await Promise.all(
      titles
        .filter(dirent => dirent.isDirectory() && !dirent.name.startsWith("."))
        .map(async dirent => {
          const caps = await readdir(path.join(ROOT_PATH, dirent.name), { withFileTypes: true });
          return {
            name: dirent.name,
            formattedName: dirent.name.toLowerCase().replace(/\s+/g, "-"),
            thumb: `/api/read/${dirent.name}/01/thumb`,
            description: `Description for ${dirent.name}`,
            caps: caps.length,
            link: `/read/${dirent.name.toLowerCase().replace(/\s+/g, "-")}`,
          };
        })
    );

    // If no query, return all titles
    if (!query) {
      return NextResponse.json(titleList);
    }

    // Configure Fuse.js for fuzzy search
    const fuseOptions = {
      keys: ['name', 'formattedName'],
      threshold: 0.4,
      includeScore: true,
    };

    const fuse = new Fuse(titleList, fuseOptions);
    const results = fuse.search(query).map(result => result.item);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: "Error processing search request" },
      { status: 500 }
    );
  }
}