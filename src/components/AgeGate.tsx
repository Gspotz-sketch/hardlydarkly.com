import { useState } from 'react'

const FLAG = 'hd-age-consent'

export function hasAgeConsent(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === 'yes'
  } catch {
    return false
  }
}

export function grantAgeConsent() {
  try {
    window.localStorage.setItem(FLAG, 'yes')
  } catch {
    // storage unavailable — consent simply won't persist
  }
}

/** Standalone 18+ entry gate (used before anyone reaches adult content). */
export default function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  const [dob, setDob] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    grantAgeConsent()
    onConfirm()
  }

  const verifyDob = () => {
    if (!dob) {
      setError('Enter your date of birth to continue.')
      return
    }
    const birth = new Date(dob)
    const now = new Date()
    let age = now.getFullYear() - birth.getFullYear()
    const monthDelta = now.getMonth() - birth.getMonth()
    if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1
    if (age >= 18) {
      confirm()
    } else {
      setError('You must be 18 or older to open the door.')
    }
  }

  return (
    <div className="age-gate" role="dialog" aria-modal="true" aria-label="Age verification">
      <div className="age-card">
        <p className="eyebrow">Restricted transmission</p>
        <h2>Adults only beyond this point.</h2>
        <p>Chapters 19–28 of <em>Hardly Darkly</em> contain explicit adult content. Enter your date of birth to continue.</p>
        <label className="age-field">
          <span>Date of birth</span>
          <input type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(event) => { setDob(event.target.value); setError('') }} />
        </label>
        {error && <p className="age-error" role="alert">{error}</p>}
        <button className="primary-cta" onClick={verifyDob}>I am 18 or older — continue</button>
        <button className="age-leave" onClick={() => { window.location.hash = '#/chapters' }}>Take me back</button>
      </div>
    </div>
  )
}
