# Hardly Darkly — Product Spec (v2.1, 2026-10-26)

Source of truth for the rebuild. The site is a **reader**, not an ebook store.

## Canonical product shape
- **No ebook. Never an ebook.** Reader only.
- **The story is ONGOING — it is NOT complete.** No page may claim or imply completeness.
  Wording: "the transmission so far", "28 transmissions, more coming", "the live edge".
- Online **reader**: prologue + 28 chapters posted so far, free to read in-browser.
- **Audio narration**: press play, the story is read aloud (Web Speech API v1).
- **End of Ch 18**: interactive Project Dark Reel signal-site survey map (11 real story sites).
- **Paywall at Ch 19**: the Steel Door — Stripe Checkout **$2.99 one-time**, 18+ consent checkbox,
  unlocks Ch 19–28 (adult). Restore-purchase flow via stored session id.
- Ch 19–28 are **adult**: age gate (DOB) before first adult visit, padlock + "adults only"
  markers in the index, `noindex` on adult routes.
- **Ads**: Google AdSense, **public pages only** — script is route-gated off adult chapters
  (adult content violates AdSense policy). Needs `VITE_ADSENSE_CLIENT`.
- **Memorabilia**: chapter art (author is delivering) → canvas / poster / postcards via Printful.
  **The rest of the memorabilia collection is UNDECIDED** — do not invent/inventory other goods.
  Gallery + formats shown; checkout wiring is phase 2 (needs author's Printful store decision).

## Technical
- Vite + React + TS, hash routing, Cloudflare Pages. Branch `develop` = preview builds;
  `main` keeps the under-construction splash until author approves.
- Pages Functions: `functions/api/checkout.ts`, `verify.ts` (Stripe), `products.ts` (Printful sync,
  static fallback in `src/data/products.ts`).
- Unlock persistence: `hd-unlocked` + `hd-unlock-session` in localStorage, verified vs Stripe.
- Env needed on Cloudflare Pages: `STRIPE_SECRET_KEY`, `PRINTFUL_API_TOKEN`, `VITE_ADSENSE_CLIENT`.

## Wording bans (author's call, enforced in copy review)
- banned: "complete", "ebook", product/inventory claims for undecided memorabilia.
