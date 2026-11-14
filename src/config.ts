// Product constants for Hardly Darkly.
// Chapters with number >= PAYWALL_FROM are behind the Steel Door.
// The door now opens with a $3.00 one-time Stripe verification
// (instant, no code) — legacy unlock codes still work as a fallback.

export const PAYWALL_FROM = 19

export const UNLOCK_PRICE_CENTS = 300

export const UNLOCK_STORAGE_KEY = 'hd-unlocked'

// Where buyers reach the author about legacy keys (comp copies, reissues).
export const UNLOCK_CONTACT = 'the author'

export const isAdultChapter = (number: number) => number >= PAYWALL_FROM
