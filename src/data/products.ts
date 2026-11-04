// Memorabilia catalog. Each chapter-art piece is offered as canvas / poster / postcards
// via Printful POD. `art` points at a file in public/images/ — populated as the new
// chapter art arrives. If /api/products (Printful sync) is reachable it overrides this list.

export type ProductFormat = 'canvas' | 'poster' | 'postcards'

// Per-format retail prices. Server-side source of truth lives in
// functions/_shared/products.ts (FORMAT_PRICES) — keep in sync. Each order
// also carries a flat $1.50 order-processing fee added at checkout
// (uniform tender-neutral fee), never sent to Printful.
export const FORMAT_PRICES: Record<'postcard' | 'poster' | 'canvas', number> = {
  postcard: 2.99,
  poster: 13.99,
  canvas: 27.99,
}

export const ORDER_PROCESSING_FEE = 1.5

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

/** Retail price per format — mirror of functions/_shared/print-spec.ts (SHAPES[].price). */
export const formatPrice: Record<ProductFormat, number> = {
  canvas: 27.99,
  poster: 13.99,
  postcards: 2.99,
}

const chapterArt = (file: string) => `/images/chapters/${file}`

export const products: Product[] = [
  {
    id: 'hd-art-10',
    title: 'Signal — Chapter 10',
    chapter: 10,
    art: chapterArt('chapter10_signal.jpg'),
    formats: ['canvas', 'poster', 'postcards'],
    note: 'The signal finds its frequency.',
  },
  {
    id: 'hd-art-13',
    title: 'Gambit — Chapter 13',
    chapter: 13,
    art: chapterArt('chapter13_gambit.jpg'),
    formats: ['canvas', 'poster', 'postcards'],
    note: 'A move made in the dark.',
  },
  {
    id: 'hd-art-18',
    title: 'Tracking — Chapter 18',
    chapter: 18,
    art: chapterArt('chapter18_tracking.jpg'),
    formats: ['canvas', 'poster', 'postcards'],
    note: 'Eleven sites, one broadcast. The survey complete.',
  },
  {
    id: 'hd-art-24',
    title: 'Hold the Line — Chapter 24',
    chapter: 24,
    art: chapterArt('chapter24_holdtheline.jpg'),
    formats: ['canvas', 'poster', 'postcards'],
    note: 'Do not let the carrier through.',
  },
  {
    id: 'hd-art-28',
    title: 'Dead Channel — Chapter 28',
    chapter: 28,
    art: chapterArt('chapter28_deadchannel.jpg'),
    formats: ['canvas', 'poster', 'postcards'],
    note: 'The last transmission. For now.',
  },
  {
    id: 'hd-art-seal',
    title: 'The Rune Seal',
    chapter: null,
    art: '/images/hardly_darkly_rune_seal.jpg',
    formats: ['poster', 'postcards'],
    note: 'Mark of the broadcast. Seal of the door.',
  },
]
