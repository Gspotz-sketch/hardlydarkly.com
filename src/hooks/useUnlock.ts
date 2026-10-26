import { useCallback, useEffect, useState } from 'react'
import { UNLOCK_SESSION_KEY, UNLOCK_STORAGE_KEY } from '../config'

export type UnlockState = {
  unlocked: boolean
  pending: boolean
  checkout: (slug: string) => Promise<void>
  restore: () => Promise<void>
}

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(UNLOCK_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Tracks the $2.99 unlock. Purchase handoff goes through /api/checkout
 * (Stripe Checkout); the success redirect returns ?paid=1&session_id=…
 * which we verify against /api/verify before granting.
 */
export default function useUnlock(): UnlockState {
  const [unlocked, setUnlocked] = useState(readFlag)
  const [pending, setPending] = useState(false)

  const grant = useCallback(() => {
    try {
      window.localStorage.setItem(UNLOCK_STORAGE_KEY, '1')
    } catch {
      // non-persistent unlock for this session
    }
    setUnlocked(true)
  }, [])

  // Handle the Stripe success redirect and stored-session restore.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const paid = params.get('paid')
    const sessionId = params.get('session_id')
    if (paid === '1' && sessionId) {
      setPending(true)
      fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data?.paid) {
            try {
              window.localStorage.setItem(UNLOCK_SESSION_KEY, sessionId)
            } catch {
              // ignore
            }
            grant()
          }
        })
        .catch(() => undefined)
        .finally(() => {
          setPending(false)
          window.history.replaceState({}, '', window.location.pathname + window.location.hash)
        })
    }
  }, [grant])

  const checkout = useCallback(async (slug: string) => {
    setPending(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      })
      const data = await response.json()
      if (data?.url) {
        window.location.assign(data.url)
      }
    } finally {
      setPending(false)
    }
  }, [])

  const restore = useCallback(async () => {
    let sessionId: string | null = null
    try {
      sessionId = window.localStorage.getItem(UNLOCK_SESSION_KEY)
    } catch {
      sessionId = null
    }
    if (!sessionId) return
    setPending(true)
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await response.json()
      if (data?.paid) grant()
    } finally {
      setPending(false)
    }
  }, [grant])

  return { unlocked, pending, checkout, restore }
}
