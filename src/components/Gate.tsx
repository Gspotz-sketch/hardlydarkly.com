import { useState } from 'react'
import { DoorClosed, DoorOpen, Lock, ShieldAlert } from 'lucide-react'
import { UNLOCK_PRICE_CENTS } from '../config'
import { hasAgeConsent } from './AgeGate'

type GateProps = {
  pending: boolean
  onCheckout: (slug: string) => void
  onRestore: () => void
  slug: string
}

/**
 * The Steel Door — paywall for Chapters 19–28.
 * Framed as the door beneath the city: 18+ check + $2.99 Stripe unlock.
 */
export default function Gate({ pending, onCheckout, onRestore, slug }: GateProps) {
  const [consented, setConsented] = useState(hasAgeConsent)
  const [showAgeHint, setShowAgeHint] = useState(false)
  const price = (UNLOCK_PRICE_CENTS / 100).toFixed(2)

  const openDoor = () => {
    if (!consented) {
      setShowAgeHint(true)
      return
    }
    onCheckout(slug)
  }

  return (
    <section className="steel-door" aria-label="Chapter locked">
      <div className="door-visual" aria-hidden="true">
        {consented ? <DoorOpen size={44} /> : <DoorClosed size={44} />}
        <span className="door-seam" />
      </div>
      <p className="eyebrow"><Lock size={13} aria-hidden="true" /> Transmission restricted</p>
      <h2>The door only opens for $2.99.</h2>
      <p className="door-copy">
        Chapters 19–28 are the adult stretch of the transmission — what broadcasts from below
        the Tenderloin Bunker. Pay once, read forever, on any device.
      </p>

      <label className="door-consent">
        <input
          type="checkbox"
          checked={consented}
          onChange={(event) => { setConsented(event.target.checked); setShowAgeHint(false) }}
        />
        <span><ShieldAlert size={14} aria-hidden="true" /> I am 18 or older and consent to viewing adult content.</span>
      </label>
      {showAgeHint && <p className="age-error" role="alert">Confirm you're 18+ first — then the door opens.</p>}

      <div className="door-actions">
        <button className="primary-cta" onClick={openDoor} disabled={pending}>
          {pending ? 'Contacting the door…' : `Unlock the full transmission — $${price}`}
        </button>
        <button className="text-link" onClick={onRestore}>Restore a previous purchase</button>
      </div>

      <p className="door-fine">One-time payment via Stripe. No subscription, no ebook — this is the reader, and the reader only.</p>
    </section>
  )
}
