// Cloudflare Pages Function — proxies the Printful store catalog for Memorabilia.
// Env required: PRINTFUL_API_TOKEN.
// Front-end falls back to its static catalog when this returns non-200.

type PrintfulVariant = {
  name: string
  retail_price?: string
}

type PrintfulProduct = {
  id: number
  name: string
  thumbnail_url?: string
  variants?: PrintfulVariant[]
}

function formatsFor(variants: PrintfulVariant[] | undefined): string[] {
  const names = (variants ?? []).map((variant) => variant.name.toLowerCase())
  const formats = new Set<string>()
  if (names.some((name) => name.includes('canvas'))) formats.add('canvas')
  if (names.some((name) => name.includes('poster'))) formats.add('poster')
  if (names.some((name) => name.includes('postcard'))) formats.add('postcards')
  return [...formats]
}

export async function onRequestGet(context: { request: Request; env: Record<string, string> }) {
  const { env } = context
  if (!env.PRINTFUL_API_TOKEN) {
    return Response.json({ error: 'printful_not_configured' }, { status: 503 })
  }

  const response = await fetch('https://api.printful.com/store/products', {
    headers: { Authorization: `Bearer ${env.PRINTFUL_API_TOKEN}` },
  })
  if (!response.ok) {
    return Response.json({ error: 'printful_upstream_error' }, { status: 502 })
  }

  const data = await response.json<{ result?: PrintfulProduct[] }>()
  const products = (data.result ?? []).map((product) => ({
    id: `pf-${product.id}`,
    title: product.name,
    art: product.thumbnail_url ?? '',
    formats: formatsFor(product.variants),
    note: '',
    chapter: null,
  }))

  return Response.json({ products })
}
