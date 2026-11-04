import { useEffect, useState } from 'react'
import { Check, ShoppingBag, X } from 'lucide-react'
import { formatLabel, formatPrice, products as fallbackProducts, type Product, type ProductFormat } from '../data/products'

/** 'postcards' (catalog plural) → 'postcard' (checkout format key). */
const formatKey = (format: ProductFormat): string => (format === 'postcards' ? 'postcard' : format)

const money = (value: number) => `$${value.toFixed(2)}`

function readCheckoutState(): 'ordered' | 'canceled' | null {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('ordered') === '1') return 'ordered'
    if (params.get('canceled') === '1') return 'canceled'
  } catch {
    /* no query, no panel */
  }
  return null
}

function clearCheckoutQuery() {
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('ordered')
    url.searchParams.delete('canceled')
    window.history.replaceState(null, '', url.toString())
  } catch {
    /* cosmetic only */
  }
}

function CheckoutPanel({ state, onDismiss }: { state: 'ordered' | 'canceled'; onDismiss: () => void }) {
  if (state === 'ordered') {
    return (
      <div className="mem-panel mem-panel-ok" role="status">
        <Check size={16} aria-hidden="true" />
        <div>
          <p className="mem-panel-title">Order confirmed.</p>
          <p>The file is already on its way to the printers. It will go out quietly, the way these things do.</p>
        </div>
        <button className="mem-panel-dismiss" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    )
  }
  return (
    <div className="mem-panel mem-panel-soft" role="status">
      <div>
        <p className="mem-panel-title">No harm done.</p>
        <p>The door stays open. The prints will be here when you are.</p>
      </div>
      <button className="mem-panel-dismiss" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

function ProductCard({ product, index, onBuy, buying }: {
  product: Product
  index: number
  onBuy: (product: Product, format: ProductFormat) => void
  buying: string | null
}) {
  const [artMissing, setArtMissing] = useState(false)
  const formats = product.formats.length ? product.formats : (['canvas', 'poster', 'postcards'] as const)
  // Buy buttons only resolve against the static catalog slugs; entries that
  // came from the live Printful sync (pf-*) are display-only here.
  const buyable = product.id.startsWith('hd-')

  return (
    <figure className="mem-card">
      {product.art && !artMissing ? (
        <img
          className="mem-art"
          src={product.art}
          alt={product.title}
          loading="lazy"
          onError={() => setArtMissing(true)}
        />
      ) : (
        <div className="mem-art mem-art-fallback" aria-hidden="true">
          <span>{String(index + 1).padStart(2, '0')}</span>
        </div>
      )}
      <figcaption>
        <div className="mem-card-head">
          <h3>{product.title}</h3>
          {product.chapter !== null && <span className="mem-chapter">Ch. {product.chapter}</span>}
        </div>
        {product.note && <p className="mem-note">{product.note}</p>}
        {buyable ? (
          <div className="mem-buy">
            {formats.map((format) => {
              const key = `${product.id}:${format}`
              return (
                <button
                  key={format}
                  className="mem-buy-btn"
                  disabled={buying !== null}
                  onClick={() => onBuy(product, format)}
                >
                  {buying === key ? 'Opening…' : `${formatLabel[format as keyof typeof formatLabel] ?? format} · ${money(formatPrice[format as keyof typeof formatPrice])}`}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="mem-formats">
            {formats.map((format) => <span key={format}>{formatLabel[format as keyof typeof formatLabel] ?? format}</span>)}
          </div>
        )}
      </figcaption>
    </figure>
  )
}

/**
 * Memorabilia — chapter art as print-on-demand goods (canvas / poster / postcards).
 * Catalog comes from /api/products (Printful sync) when configured; otherwise the
 * bundled static catalog. Buy buttons POST /api/create-checkout-session and
 * redirect to Stripe Checkout; Stripe sends buyers back to
 * /memorabilia?ordered=1 or ?canceled=1 and the panels above take it from there.
 */
export default function Memorabilia() {
  const [items, setItems] = useState<Product[]>(fallbackProducts)
  const [checkoutState, setCheckoutState] = useState<'ordered' | 'canceled' | null>(() => readCheckoutState())
  const [buying, setBuying] = useState<string | null>(null)
  const [buyError, setBuyError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/products')
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        if (cancelled || !Array.isArray(data?.products) || data.products.length === 0) return
        setItems(data.products.map((product: Product) => ({
          ...product,
          formats: product.formats?.length ? product.formats : ['canvas', 'poster', 'postcards'],
        })))
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [])

  // Stripe sends buyers back to /memorabilia?ordered=1; the route-level
  // scroll in App.tsx brings the counter into view — this component only
  // renders the panel.

  const buy = async (product: Product, format: ProductFormat) => {
    const key = `${product.id}:${format}`
    setBuying(key)
    setBuyError(null)
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: product.id, format: formatKey(format) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || `Checkout failed (${response.status})`)
      }
      window.location.href = data.url
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Checkout failed — try again.')
      setBuying(null)
    }
  }

  const dismissPanel = () => {
    setCheckoutState(null)
    clearCheckoutQuery()
  }

  return (
    <section className="memorabilia-section" id="memorabilia" aria-labelledby="memorabilia-title">
      <div className="memorabilia-copy">
        <div className="section-label"><span>02</span> Memorabilia</div>
        <p className="eyebrow">Artifacts from the edge</p>
        <h2 id="memorabilia-title">Take the signal<br />off the screen.</h2>
        <p>Chapter art from the manuscript, printed on demand — canvas for the wall, posters for the door, postcards for whoever still checks the mail.</p>
        <p className="memorabilia-note"><ShoppingBag size={14} aria-hidden="true" /> Printed and shipped by Printful. No stock, no restocks, no landfill.</p>
        {checkoutState && <CheckoutPanel state={checkoutState} onDismiss={dismissPanel} />}
        {buyError && (
          <p className="mem-buy-error" role="alert">{buyError}</p>
        )}
      </div>
      <div className="memorabilia-grid">
        {items.map((product, index) => (
          <ProductCard key={product.id} product={product} index={index} onBuy={buy} buying={buying} />
        ))}
      </div>
    </section>
  )
}
