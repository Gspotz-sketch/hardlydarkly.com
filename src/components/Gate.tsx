import { useState, type FormEvent } from 'react'
import { DoorClosed, DoorOpen, Lock, ShieldAlert } from 'lucide-react'
import { CASHAPP_PAY_URL, UNLOCK_CONTACT, UNLOCK_PRICE_CENTS } from '../config'
import type { UnlockError } from '../hooks/useUnlock'
import { hasAgeConsent } from './AgeGate'

type GateProps = {
  pending: boolean
  error: UnlockError
  onSubmitCode: (code: string) => Promise<boolean>
}

/**
 * The Steel Door — paywall for Chapters 19–28.
 * $2.99 via Cash App; the author hands back an unlock code by hand.
 */
export default function Gate({ pending, error, onSubmitCode }: GateProps) {
  const [consented, setConsented] = useState(hasAgeConsent)
  const [showAgeHint, setShowAgeHint] = useState(false)
  const [code, setCode] = useState('')
  const price = (UNLOCK_PRICE_CENTS / 100).toFixed(2)

  const requireConsent = () => {
    if (!consented) {
      setShowAgeHint(true)
      return false
    }
    return true
  }

  const pay = () => {
    if (!requireConsent()) return
    window.open(CASHAPP_PAY_URL, '_blank', 'noopener,noreferrer')
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
        <button className="primary-cta" onClick={pay}>
          Unlock the full transmission — ${price} via Cash App
        </button>
        <ol className="door-steps">
          <li><span className="step-num">1</span><span>Tap the button and send <strong>${price}</strong> to <strong>$hardlydarkly1</strong> in Cash App.</span></li>
          <li><span className="step-num">2</span><span>Message {UNLOCK_CONTACT} with your Cash App name ($cashtag).</span></li>
          <li><span className="step-num">3</span><span>Your key arrives by hand — enter it below and the door stays open, on any device.</span></li>
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

      <p className="door-fine">One-time payment via Cash App. No subscription, no ebook — this is the reader, and the reader only. Keys are cut by hand; expect a few hours at most.</p>
    </section>
  )
}
