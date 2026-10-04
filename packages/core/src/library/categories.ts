// Client-safe: no fs access, so this can be imported from both server
// code (metadata.ts) and client components without dragging fs/promises
// into the browser bundle.
const CATEGORY_ALIASES: Record<string, string> = {
  'action': 'Ação',
  'acao': 'Ação',
  'ação': 'Ação',
  'adventure': 'Aventura',
  'aventura': 'Aventura',
  'comedy': 'Comédia',
  'comedia': 'Comédia',
  'comédia': 'Comédia',
  'drama': 'Drama',
  'fantasy': 'Fantasia',
  'fantasia': 'Fantasia',
  'horror': 'Horror',
  'terror': 'Terror',
  'isekai': 'Isekai',
  'magic': 'Magia',
  'magia': 'Magia',
  'martial arts': 'Artes Marciais',
  'artes marciais': 'Artes Marciais',
  'mecha': 'Mecha',
  'mystery': 'Mistério',
  'misterio': 'Mistério',
  'mistério': 'Mistério',
  'psychological': 'Psicológico',
  'psicologico': 'Psicológico',
  'psicológico': 'Psicológico',
  'romance': 'Romance',
  'sci-fi': 'Ficção Científica',
  'scifi': 'Ficção Científica',
  'science fiction': 'Ficção Científica',
  'ficção científica': 'Ficção Científica',
  'ficcao cientifica': 'Ficção Científica',
  'seinen': 'Seinen',
  'shoujo': 'Shoujo',
  'shojo': 'Shoujo',
  'shounen': 'Shounen',
  'shonen': 'Shounen',
  'slice of life': 'Slice of Life',
  'supernatural': 'Sobrenatural',
  'sobrenatural': 'Sobrenatural',
  'sports': 'Esportes',
  'esportes': 'Esportes',
  'thriller': 'Thriller',
  'zombie': 'Zumbi',
  'zumbi': 'Zumbi',
  'historical': 'Histórico',
  'historico': 'Histórico',
  'histórico': 'Histórico',
  'school': 'Escolar',
  'escolar': 'Escolar',
  'school life': 'Vida Escolar',
  'vida escolar': 'Vida Escolar',
  'ecchi': 'Ecchi',
  'harem': 'Harem',
  'josei': 'Josei',
  'mature': 'Maduro',
  'maduro': 'Maduro',
  'adult': 'Adulto',
  'adulto': 'Adulto',
  'gore': 'Gore',
  'military': 'Militar',
  'militar': 'Militar',
  'music': 'Música',
  'musica': 'Música',
  'música': 'Música',
  'parody': 'Paródia',
  'parodia': 'Paródia',
  'paródia': 'Paródia',
  'police': 'Policial',
  'policial': 'Policial',
  'post-apocalyptic': 'Pós-Apocalíptico',
  'pos-apocaliptico': 'Pós-Apocalíptico',
  'pós-apocalíptico': 'Pós-Apocalíptico',
  'reincarnation': 'Reencarnação',
  'reencarnacao': 'Reencarnação',
  'reencarnação': 'Reencarnação',
  'revenge': 'Vingança',
  'vinganca': 'Vingança',
  'vingança': 'Vingança',
  'samurai': 'Samurai',
  'space': 'Espaço',
  'espaco': 'Espaço',
  'espaço': 'Espaço',
  'super power': 'Super Poderes',
  'super powers': 'Super Poderes',
  'super poderes': 'Super Poderes',
  'survival': 'Sobrevivência',
  'sobrevivencia': 'Sobrevivência',
  'sobrevivência': 'Sobrevivência',
  'time travel': 'Viagem no Tempo',
  'viagem no tempo': 'Viagem no Tempo',
  'tragedy': 'Tragédia',
  'tragedia': 'Tragédia',
  'tragédia': 'Tragédia',
  'vampire': 'Vampiro',
  'vampiro': 'Vampiro',
  'video game': 'Video Game',
  'webtoon': 'Webtoon',
  'manhwa': 'Manhwa',
  'manhua': 'Manhua',
}

export function normalizeCategory(category: string): string {
  const key = category.toLowerCase().trim()
  return CATEGORY_ALIASES[key] || category
}


export interface CategoryMap {
  [categoryId: string]: {
    name: string
    titles: string[]
  }
}

export function buildCategoryMap(
  titles: { name: string; modifiedAt: number; caps: number; categories: string[] }[]
): CategoryMap {
  const categoryMap: CategoryMap = {}

  categoryMap['todos'] = {
    name: 'Todos',
    titles: titles.map((t) => t.name),
  }

  categoryMap['recentes'] = {
    name: 'Recentes',
    titles: [...titles]
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
      .slice(0, 20)
      .map((t) => t.name),
  }

  for (const title of titles) {
    for (const category of title.categories) {
      const normalizedName = normalizeCategory(category)
      const categoryId = normalizedName.toLowerCase().replace(/\s+/g, '-')
      if (!categoryMap[categoryId]) {
        categoryMap[categoryId] = {
          name: normalizedName,
          titles: [],
        }
      }
      categoryMap[categoryId].titles.push(title.name)
    }
  }

  categoryMap['menos-de-100'] = {
    name: 'Menos de 100 capítulos',
    titles: titles.filter((t) => t.caps < 100).map((t) => t.name),
  }

  categoryMap['mais-de-200'] = {
    name: 'Mais de 200 capítulos',
    titles: titles.filter((t) => t.caps >= 200).map((t) => t.name),
  }

  categoryMap['mais-de-500'] = {
    name: 'Mais de 500 capítulos',
    titles: titles.filter((t) => t.caps >= 500).map((t) => t.name),
  }

  categoryMap['mais-de-1000'] = {
    name: 'Mais de 1000 capítulos',
    titles: titles.filter((t) => t.caps >= 1000).map((t) => t.name),
  }

  return categoryMap
}
