import type { Title } from '@/types/api'
import { getCategories, getMetadata, getTitlesByCategory } from '@/services/metadata'
import Hero from '@/components/home/Hero'
import SectionCarousel from '@/components/home/SectionCarousel'
import ContinueReading from '@/components/home/ContinueReading'

export default async function Home() {
  const categories = await getCategories()

  const titlesByCategory: Record<string, Omit<Title, 'modifiedAt' | 'categories' | 'author'>[]> = {}
  let featuredTitle: Title | null = null

  for (const cat of categories) {
    const titles = await getTitlesByCategory(cat.id)
    titlesByCategory[cat.id] = titles

    if (!featuredTitle && (cat.id === 'todos' || cat.id === 'recentes') && titles.length > 0) {
      const metadata = await getMetadata(titles[0].name)
      const randomIndex = Math.floor(Math.random() * Math.min(titles.length, 10))
      featuredTitle = titles[randomIndex] as Title
      featuredTitle.description = metadata.author ? `Por ${metadata.author}` : `Description for ${featuredTitle.name}`
    }
  }

  return (
    <div className="min-h-screen bg-black space-y-8 pb-12">
      {featuredTitle && <Hero title={featuredTitle} allTitles={Object.values(titlesByCategory).flat()} />}
      <ContinueReading />
      {categories.filter((category) => category.count > 2).map((category) => (
        <SectionCarousel
          key={category.id}
          title={`${category.name}${category.count ? ` (${category.count})` : ''}`}
          titles={titlesByCategory[category.id] ?? []}
        />
      ))}
    </div>
  )
}
