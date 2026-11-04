// Shared print-fulfillment spec — Hardly Darkly Memorabilia.
// Single source of truth mapping site products → Printful blanks.
// Keep the product table in sync with the static catalog in
// src/data/products.ts (frontend display) — checkout AND fulfillment both
// build from THIS table.
//
// Site productId scheme (deterministic offsets):
//   base design id + shape.offset → buyable print variant
//     postcard = base + 300 · poster = base + 400 · canvas = base + 500
//
// Print conventions (HD house rules, per owner spec):
//   - NO frame, NO mat — canvas is the standard wrapped blank, poster is
//     the plain sheet. We never pass frame/mat options to Printful.
//   - positioning: fit — art is scaled to fit the blank, never stretched
//     or cropped. (Constant below; Printful's default for these blanks.)
//   - dpi floor: chapter art under ~150dpi prints soft at poster size.
//     Recorded as a constant so checkout/fulfillment share the number.

export type ShapeKey = 'postcard' | 'poster' | 'canvas'

export const SHAPES: Record<
  ShapeKey,
  {
    catalogId: number
    label: string
    /** non-apparel: size string matched against the catalog variant */
    fixedSize: string
    offset: number
    /** retail price for this shape, all designs (USD) */
    price: number
  }
> = {
  // Retail: ≥ Printful cost × 1.15, .99 anchored. Blank costs from the live
  // catalog (2026-11-05 pass): 433 postcard 4″×6″ cost $1.50 · 1 poster
  // 18″×24″ cost $11.95 · 3 canvas 12″×16″ cost $24.25.
  postcard: { catalogId: 433, label: 'Postcard', fixedSize: '4″×6″',   offset: 300, price: 2.99 },
  poster:   { catalogId: 1,   label: 'Poster',   fixedSize: '18″×24″', offset: 400, price: 13.99 },
  canvas:   { catalogId: 3,   label: 'Canvas',   fixedSize: '12″×16″', offset: 500, price: 27.99 },
}

export const SHAPE_KEYS = Object.keys(SHAPES) as ShapeKey[]

/** File positioning: fit, never stretch/crop. */
export const PRINT_POSITIONING = 'fit'
/** Chapter art below this prints soft at poster size. */
export const DPI_FLOOR = 150
/**
 * Flat per-order handling fee added at checkout (USD). Owner-set constant —
 * tune here and checkout follows. Applied identically on every rail so no
 * tender type is singled out (card-surcharge rules); never sent to Printful.
 */
export const ORDER_FEE_USD = 1.5

export interface HdProduct {
  id: number
  /** stable public slug — checkout resolves by this, not by numeric id */
  slug: string
  name: string
  /** artwork path under https://hardlydarkly.com/images/ */
  file: string
}

// Base designs — mirror of src/data/products.ts. `file` lives under
// /images/; chapter art under /images/chapters/.
export const HD_PRODUCTS: HdProduct[] = [
  { id: 10, slug: 'hd-art-10',  name: 'Signal — Chapter 10',      file: 'chapters/chapter10_signal.jpg' },
  { id: 13, slug: 'hd-art-13',  name: 'Gambit — Chapter 13',      file: 'chapters/chapter13_gambit.jpg' },
  { id: 18, slug: 'hd-art-18',  name: 'Tracking — Chapter 18',    file: 'chapters/chapter18_tracking.jpg' },
  { id: 24, slug: 'hd-art-24',  name: 'Hold the Line — Chapter 24', file: 'chapters/chapter24_holdtheline.jpg' },
  { id: 28, slug: 'hd-art-28',  name: 'Dead Channel — Chapter 28', file: 'chapters/chapter28_deadchannel.jpg' },
  { id: 1,  slug: 'hd-art-seal', name: 'The Rune Seal',           file: 'hardly_darkly_rune_seal.jpg' },
]

export function findBySlug(slug: unknown): HdProduct | undefined {
  if (typeof slug !== 'string') return undefined
  return HD_PRODUCTS.find((p) => p.slug === slug)
}

export function findById(id: number): HdProduct | undefined {
  return HD_PRODUCTS.find((p) => p.id === id)
}

/** Decompose a site productId into base design + shape. */
export function resolveShape(productId: number): { base: HdProduct; shape: ShapeKey } | null {
  const offset = SHAPE_KEYS.map((k) => SHAPES[k].offset).find(
    (o) => productId > o && productId - o <= 100,
  )
  if (offset === undefined) return null
  const base = findById(productId - offset)
  const shape = SHAPE_KEYS.find((k) => SHAPES[k].offset === offset)
  if (!base || !shape) return null
  return { base, shape }
}

/** Public artwork URL Printful downloads and prints. */
export function artUrl(base: HdProduct): string {
  return `https://hardlydarkly.com/images/${base.file}`
}

// --- Live catalog variant resolution ---------------------------------------
// GET /products/{catalogId} is public on the Printful catalog API; we still
// send the store token when available. Results are cached on globalThis for
// 6h so order-time resolution costs zero extra API calls after the first.

type CatalogVariant = { id: number; size?: string; color?: string; price?: number }

const CACHE_TTL_MS = 6 * 60 * 60 * 1000

function cacheStore(): Map<number, { ts: number; variants: CatalogVariant[] }> {
  const g = globalThis as Record<string, unknown>
  if (!g.__hdCatalogCache) g.__hdCatalogCache = new Map()
  return g.__hdCatalogCache as Map<number, { ts: number; variants: CatalogVariant[] }>
}

/** Loose-normalize size labels: '18″×24″' → '18x24'. */
function normSize(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[″"’'‘ ]/g, '')
    .replace(/×/g, 'x')
}

async function fetchCatalogVariants(catalogId: number, token?: string): Promise<CatalogVariant[]> {
  const res = await fetch(`https://api.printful.com/products/${catalogId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  })
  if (!res.ok) throw new Error(`Printful catalog ${catalogId} returned ${res.status}`)
  const data = await res.json()
  return data?.result?.variants ?? []
}

async function catalogVariants(catalogId: number, token?: string): Promise<CatalogVariant[]> {
  const cache = cacheStore()
  const hit = cache.get(catalogId)
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.variants
  const variants = await fetchCatalogVariants(catalogId, token)
  cache.set(catalogId, { ts: Date.now(), variants })
  return variants
}

/**
 * Resolve the Printful catalog variant ID for a shape. Non-apparel: exact
 * fixed-size match, else first variant.
 */
export async function resolveVariantId(shapeKey: ShapeKey, token?: string): Promise<number> {
  const shape = SHAPES[shapeKey]
  const variants = await catalogVariants(shape.catalogId, token)
  const want = normSize(shape.fixedSize)
  const exact = variants.find((v) => normSize(v.size) === want)
  if (exact) return exact.id
  if (variants[0]) return variants[0].id
  throw new Error(`No Printful variant found for shape ${shapeKey} (catalog ${shape.catalogId})`)
}
