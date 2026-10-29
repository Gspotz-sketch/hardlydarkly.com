// Product constants for Hardly Darkly.
// Chapters with number >= PAYWALL_FROM are behind the Steel Door ($2.99, Cash App + unlock code).

export const PAYWALL_FROM = 19

export const UNLOCK_PRICE_CENTS = 299

export const UNLOCK_STORAGE_KEY = 'hd-unlocked'

// Where buyers claim their unlock code after paying (email address or SMS number).
// PRE-LAUNCH BLOCKER: replace with the real, monitored contact before the door goes live.
export const UNLOCK_CONTACT = 'the author'

// Cash App for Business $cashtag — amount-prefilled $2.99 link.
export const CASHAPP_PAY_URL = 'https://cash.app/$hardlydarkly1/2.99'

export const isAdultChapter = (number: number) => number >= PAYWALL_FROM
