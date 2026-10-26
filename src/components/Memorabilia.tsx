import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { formatLabel, products as fallbackProducts, type Product } from '../data/products'

function ProductCard({ product, index }: { product: Product; index: number }) {
  const [artMissing, setArtMissing] = useState(false)
  const formats = product.formats.length ? product.formats : (['canvas', 'poster', 'postcards'] as const)

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
        <div className="mem-formats">
          {formats.map((format) => <span key={format}>{formatLabel[format as keyof typeof formatLabel] ?? format}</span>)}
        </div>
      </figcaption>
    </figure>
  )
}

/**
 * Memorabilia — chapter art as print-on-demand goods (canvas / poster / postcards).
 * Catalog comes from /api/products (Printful sync) when configured; otherwise the
 * bundled static catalog. Checkout wiring is phase 2 (see SPEC.md).
 */
export default function Memorabilia() {
  const [items, setItems] = useState<Product[]>(fallbackProducts)

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

  return (
    <section className="memorabilia-section" id="memorabilia" aria-labelledby="memorabilia-title">
      <div className="memorabilia-copy">
        <div className="section-label"><span>02</span> Memorabilia</div>
        <p className="eyebrow">Artifacts from the edge</p>
        <h2 id="memorabilia-title">Take the signal<br />off the screen.</h2>
        <p>Chapter art from the manuscript, printed on demand — canvas for the wall, posters for the door, postcards for whoever still checks the mail.</p>
        <p className="memorabilia-note"><ShoppingBag size={14} aria-hidden="true" /> Printed and shipped by Printful. No stock, no restocks, no landfill.</p>
      </div>
      <div className="memorabilia-grid">
        {items.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
      </div>
    </section>
  )
}
