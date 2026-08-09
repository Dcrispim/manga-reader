import { NextResponse } from "next/server";
import { getAllTitles } from "@/services/metadata";
import { isSearchIndexBuilt, rebuildSearchIndex, searchTitles } from "@/services/searchIndex";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';

    // No query: just list everything, same as before (no need for FTS here).
    if (!query) {
      const titleList = (await getAllTitles()).map((title) => ({
        id: title.id,
        name: title.name,
        thumb: title.thumb,
        description: title.description,
        caps: title.caps,
        link: title.link,
        categories: title.categories,
        author: title.author,
      }))
      return NextResponse.json(titleList);
    }

    // Self-heal on first use so search isn't empty before anyone has hit
    // the manual "rebuild index" button in Settings; after that, the index
    // only reflects library changes once rebuilt manually.
    if (!isSearchIndexBuilt()) {
      await rebuildSearchIndex()
    }

    const results = await searchTitles(query);
    return NextResponse.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: "Error processing search request" },
      { status: 500 }
    );
  }
}