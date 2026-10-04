export interface Title {
  id: string
  name: string
  thumb: string
  description: string
  caps: number
  link: string
}

export interface Category {
  id: string
  name: string
  count?: number
}
