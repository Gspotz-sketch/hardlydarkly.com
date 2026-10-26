// Memorabilia catalog. Each chapter-art piece is offered as canvas / poster / postcards
// via Printful POD. `art` points at a file in public/art/ — populated as the new
// chapter art arrives. If /api/products (Printful sync) is reachable it overrides this list.

export type ProductFormat = 'canvas' | 'poster' | 'postcards'

export type Product = {
  id: string
  title: string
  chapter: number | null // null = standalone piece
  art: string
  formats: ProductFormat[]
  note: string
}

export const formatLabel: Record<ProductFormat, string> = {
  canvas: 'Canvas',
  poster: 'Poster',
  postcards: 'Postcards',
}

export const products: Product[] = [
  {
    id: 'hd-art-01',
    title: 'Signal Site 01 — Sutro Tower',
    chapter: null,
    art: '/art/placeholder-01.webp',
    formats: ['canvas', 'poster', 'postcards'],
    note: 'The antenna at the top of the city. 19.8 Hz, broadcasting.',
  },
  {
    id: 'hd-art-02',
    title: 'The Steel Door',
    chapter: null,
    art: '/art/placeholder-02.webp',
    formats: ['canvas', 'poster', 'postcards'],
    note: 'Holding since 1977. Do not open for less than the truth.',
  },
  {
    id: 'hd-art-03',
    title: '4th and King, First Contact',
    chapter: 0,
    art: '/art/placeholder-03.webp',
    formats: ['canvas', 'poster', 'postcards'],
    note: 'Where the air first tore. Platform 3.',
  },
  {
    id: 'hd-art-04',
    title: 'The Tenderloin Bunker',
    chapter: null,
    art: '/art/placeholder-04.webp',
    formats: ['canvas', 'poster', 'postcards'],
    note: 'Sub-level survey, Project Dark Reel. Field team did not return.',
  },
]
