import { useCallback, useState } from 'react'
import { UNLOCK_STORAGE_KEY } from '../config'

export type UnlockError = 'invalid' | 'network' | null

export type UnlockState = {
  unlocked: boolean
  pending: boolean
  error: UnlockError
  submitCode: (code: string) => Promise<boolean>
}

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Tracks the $2.99 unlock of the adult chapters (19–28).
 * Payment happens off-site on Cash App; the buyer comes back with an unlock
 * code, which /api/unlock checks against the UNLOCK_CODES env var.
 * The unlock flag lives in localStorage, so the same code also re-opens the
 * door on a new device — lost code, message the author for a reissue.
 */
export default function useUnlock(): UnlockState {
  const [unlocked, setUnlocked] = useState(readFlag)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<UnlockError>(null)

  const grant = useCallback(() => {
    try {
      window.localStorage.setItem(UNLOCK_STORAGE_KEY, '1')
    } catch {
      // non-persistent unlock for this session
    }
    setUnlocked(true)
  }, [])

  const submitCode = useCallback(async (code: string) => {
    const trimmed = code.trim()
    if (!trimmed) return false
    setPending(true)
    setError(null)
    try {
      const response = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })
      if (response.status === 403) {
        setError('invalid')
        return false
      }
      if (!response.ok) {
        setError('network')
        return false
      }
      grant()
      return true
    } catch {
      setError('network')
      return false
    } finally {
      setPending(false)
    }
  }, [grant])

  return { unlocked, pending, error, submitCode }
}
