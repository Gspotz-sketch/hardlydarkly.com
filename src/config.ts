// Product constants for Hardly Darkly.
// Chapters with number >= PAYWALL_FROM are behind the Steel Door ($2.99, Stripe).

export const PAYWALL_FROM = 19

export const UNLOCK_PRICE_CENTS = 299

export const UNLOCK_STORAGE_KEY = 'hd-unlocked'

export const UNLOCK_SESSION_KEY = 'hd-unlock-session'

export const isAdultChapter = (number: number) => number >= PAYWALL_FROM
