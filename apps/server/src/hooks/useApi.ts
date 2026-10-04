'use client'
import { useCallback } from 'react'
import { fetchData } from '@/services/fetch'
import type { Category, Title } from '@/types/api'

export function useApi() {
  const getCategories = useCallback(async (): Promise<Category[]> => {
    const data = await fetchData('/api/categories')
    return data?.categories ?? []
  }, [])

  const getTitlesByCategory = useCallback(
    async (categoryId: string): Promise<Title[]> => {
      const data = await fetchData(`/api/categories/${categoryId}`)
      return data?.titles ?? []
    },
    []
  )

  const getAllTitles = useCallback(async (): Promise<Title[]> => {
    const data = await fetchData('/api/list')
    return Array.isArray(data) ? data : []
  }, [])

  return {
    getCategories,
    getTitlesByCategory,
    getAllTitles,
  }
}
