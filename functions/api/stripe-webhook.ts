// Stripe → Printful order automation — Hardly Darkly Memorabilia.
//
// Flow:
//   checkout.session.completed → verify signature → fulfillOrder
//     (_shared/fulfill.ts) → Printful draft → confirm.
//   charge.refunded → cancelOrderByExtId — the Printful order is canceled
//     while still unfulfilled; a too-late cancel is recorded, not hidden.
//
// Required Cloudflare Pages env vars:
//   STRIPE_WEBHOOK_SECRET  — from Stripe dashboard → Developers → Webhooks
//   PRINTFUL_API_TOKEN     — personal access token
//   PRINTFUL_STORE_ID      — optional, defaults to 18913616
//   ORDER_TRACKING         — KV binding (claims + evidence ledger)

import { fulfillOrder, cancelOrderByExtId } from '../_shared/fulfill'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

const hex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

async function verifyStripeSignature(rawBody, sigHeader, secret) {
  // sigHeader looks like: t=1700000000,v1=abc123,...  (take the LAST v1)
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => kv.split('=').slice(0, 2)),
  )
  const t = parts.t
  const v1 = parts.v1
  if (!t || !v1) return { ok: false, error: 'malformed Stripe-Signature header' }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - Number(t)) > 300) {
    return { ok: false, error: 'signature timestamp outside tolerance' }
  }

  // Stripe signs with the DECODED key bytes: whsec_ + base64(raw key).
  let keyBytes: Uint8Array
  if (secret.startsWith('whsec_')) {
    const bin = atob(secret.slice('whsec_'.length))
    keyBytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  } else {
    keyBytes = new TextEncoder().encode(secret)
  }

  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${t}.${rawBody}`),
  )
  const expected = hex(mac)

  // timing-safe compare
  let diff = 0
  const a = expected.padEnd(v1.length, '0')
  const b = v1.padEnd(expected.length, '0')
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  if (diff !== 0 || expected.length !== v1.length) {
    return { ok: false, error: 'signature mismatch' }
  }
  return { ok: true }
}

export async function onRequestPost(context) {
  const { STRIPE_WEBHOOK_SECRET, PRINTFUL_API_TOKEN } = context.env

  if (!STRIPE_WEBHOOK_SECRET || !PRINTFUL_API_TOKEN) {
    return json({ error: 'Server misconfiguration: missing webhook env vars' }, 500)
  }

  const rawBody = await context.request.text()
  const sig = context.request.headers.get('stripe-signature') || ''

  const check = await verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)
  if (!check.ok) {
    return json({ error: `Webhook verification failed: ${check.error}` }, 400)
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400)
  }

  // --- Refund path ----------------------------------------------------------
  if (event.type === 'charge.refunded') {
    const charge = event.data.object
    const extId = charge?.metadata?.hd_ext
    if (!extId) {
      // Refund for something that isn't a print order (e.g. the Ch19 unlock)
      // — acknowledge so Stripe stops retrying, but do nothing.
      return json({ received: true, ignored: 'no hd_ext metadata' })
    }
    const result = await cancelOrderByExtId(context.env, String(extId))
    return json(
      {
        received: true,
        canceled: result.ok,
        printfulOrderId: result.printfulOrderId ?? null,
        ...(result.detail !== undefined ? { detail: result.detail } : {}),
      },
      result.ok ? 200 : result.status,
    )
  }

  if (event.type !== 'checkout.session.completed') {
    return json({ received: true, ignored: event.type })
  }

  const session = event.data.object

  // --- Recipient -----------------------------------------------------------
  // API 2026-09-30+: sessions no longer expose `shipping_details` —
  // the collected address now lives in customer_details (shipping == billing
  // when shipping_address_collection is on). Fall back across both shapes.
  const ship = session.shipping_details || session.customer_details || {}
  const addr = ship.address || {}
  const customer = session.customer_details || {}
  const recipient = {
    name: ship.name || customer.name || 'Customer',
    address1: addr.line1 || '',
    address2: addr.line2 || undefined,
    city: addr.city || '',
    state_code: addr.state || undefined,
    country_code: addr.country || 'US',
    zip: addr.postal_code || '',
    email: customer.email || undefined,
    phone: ship.phone || customer.phone || undefined,
  }

  const result = await fulfillOrder(context.env, {
    // hd_ext was minted at checkout; Printful caps external_id at 32 chars.
    extId: String(session.metadata?.hd_ext || session.id).slice(0, 32),
    productId: Number(session.metadata?.product_id),
    productName: session.metadata?.product_name || 'Unknown product',
    amountTotalCents: session.amount_total,
    recipient,
  })

  if (!result.ok) {
    return json(
      { error: result.error, ...(result.detail !== undefined ? { detail: result.detail } : {}) },
      result.status,
    )
  }
  return json({
    received: true,
    ...(result.duplicate ? { duplicate: true } : {}),
    ...(result.dryRun ? { dryRun: true, wouldCreate: result.wouldCreate } : {}),
    printfulOrderId: result.printfulOrderId,
    confirmed: result.confirmed,
    variantId: result.variantId,
    variantSource: result.variantSource,
    file: result.file,
  })
}
