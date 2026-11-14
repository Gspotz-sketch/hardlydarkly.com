import { useState, type FormEvent } from 'react'
import { DoorClosed, DoorOpen, Lock, ShieldAlert } from 'lucide-react'
import { UNLOCK_CONTACT, UNLOCK_PRICE_CENTS } from '../config'
import type { UnlockError } from '../hooks/useUnlock'
import { hasAgeConsent } from './AgeGate'

type GateProps = {
  pending: boolean
  error: UnlockError
  onSubmitCode: (code: string) => Promise<boolean>
}

/**
 * The Steel Door — paywall for Chapters 19–28.
 * $3.00 one-time Stripe verification; the door opens the moment payment lands.
 */
export default function Gate({ pending, error, onSubmitCode }: GateProps) {
  const [consented, setConsented] = useState(hasAgeConsent)
  const [showAgeHint, setShowAgeHint] = useState(false)
  const [code, setCode] = useState('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState(false)
  const price = (UNLOCK_PRICE_CENTS / 100).toFixed(2)

  const requireConsent = () => {
    if (!consented) {
      setShowAgeHint(true)
      return false
    }
    return true
  }

  const verify = async () => {
    if (!requireConsent() || starting) return
    setStarting(true)
    setStartError(false)
    try {
      const response = await fetch('/api/create-verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = (await response.json()) as { url?: string }
      if (!response.ok || !data.url) {
        setStartError(true)
        setStarting(false)
        return
      }
      window.location.assign(data.url)
    } catch {
      setStartError(true)
      setStarting(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!requireConsent()) return
    void onSubmitCode(code)
  }

  return (
    <section className="steel-door" aria-label="Chapter locked">
      <div className="door-visual" aria-hidden="true">
        {consented ? <DoorOpen size={44} /> : <DoorClosed size={44} />}
        <span className="door-seam" />
      </div>
      <img className="door-seal" src="/images/hardly_darkly_rune_seal.jpg" alt="" aria-hidden="true" />
      <p className="eyebrow"><Lock size={13} aria-hidden="true" /> Transmission restricted</p>
      <h2>The door only opens for ${price}.</h2>
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
        <button className="primary-cta" onClick={() => { void verify() }} disabled={starting}>
          {starting ? 'Reaching the register…' : `Verify once — $${price} by card`}
        </button>
        {startError && <p className="age-error" role="alert">The register didn't answer. Try again in a minute.</p>}
        <ol className="door-steps">
          <li><span className="step-num">1</span><span>Tap verify and pay <strong>${price}</strong> by card — takes about a minute.</span></li>
          <li><span className="step-num">2</span><span>The door opens the moment payment lands — instantly, no code to wait for.</span></li>
          <li><span className="step-num">3</span><span>Verified for good, on any device. The key lives in this browser.</span></li>
        </ol>
        <form className="door-code" onSubmit={submit}>
          <label htmlFor="door-code-input">Have a key?</label>
          <div className="door-code-row">
            <input
              id="door-code-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="EMBER-4F2K"
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
            />
            <button type="submit" className="text-link" disabled={pending || !code.trim()}>
              {pending ? 'Turning…' : 'Open the door'}
            </button>
          </div>
          {error === 'invalid' && <p className="age-error" role="alert">That key doesn't turn — check each character, or message {UNLOCK_CONTACT} if you never got one.</p>}
          {error === 'network' && <p className="age-error" role="alert">The line is down. Try again in a minute.</p>}
        </form>
      </div>

      <p className="door-fine">One-time ${price} card payment via Stripe. No subscription, no ebook — this is the reader, and the reader only. Keys below are the old hand-cut kind; still welcome.</p>
    </section>
  )
}
