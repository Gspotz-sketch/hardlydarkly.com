// Stripe Checkout entry point — Hardly Darkly Memorabilia.
// POST /api/create-checkout-session  { slug: 'hd-art-10', format: 'poster' }
//   → { url } — redirect the buyer there; Stripe hosts the rest.
//
// Env required: STRIPE_SECRET_KEY.
// Prices come from _shared/print-spec.ts (SHAPES[format].price) + the flat
// ORDER_FEE_USD handling fee — tune there, never here.

import { findBySlug, SHAPES, ORDER_FEE_USD, type ShapeKey } from '../_shared/print-spec'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Printful external_id for this attempt: hd- + 28 alnum = 31 chars (cap 32). */
function newExtId(): string {
  return `hd-${crypto.randomUUID().replace(/-/g, '').slice(0, 28)}`
}

export async function onRequestPost(context) {
  const { env } = context

  let body
  try {
    body = await context.request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const product = findBySlug(body?.slug)
  const format: ShapeKey | undefined = SHAPES[body?.format] ? body.format : undefined
  if (!product || !format) {
    return json({ error: 'Unknown product or format' }, 400)
  }
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Server misconfiguration: STRIPE_SECRET_KEY missing' }, 500)
  }

  const shape = SHAPES[format]
  const displayName = `${product.name} — ${shape.label}`
  const extId = newExtId()

  const params = new URLSearchParams({
    mode: 'payment',
    success_url: 'https://hardlydarkly.com/memorabilia?ordered=1',
    cancel_url: 'https://hardlydarkly.com/memorabilia?canceled=1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(Math.round(shape.price * 100)),
    'line_items[0][price_data][product_data][name]': displayName,
    'line_items[0][quantity]': '1',
    // Physical products — collect a shipping address
    'shipping_address_collection[allowed_countries][0]': 'US',
    'shipping_address_collection[allowed_countries][1]': 'CA',
    'metadata[product_id]': String(product.id + shape.offset),
    'metadata[product_name]': displayName,
    'metadata[format]': format,
    'metadata[hd_ext]': extId,
    // Carry hd_ext onto the PaymentIntent/Charge so charge.refunded can
    // find the Printful order without scanning the ledger.
    'payment_intent_data[metadata][hd_ext]': extId,
    allow_promotion_codes: 'true',
  })

  // Flat handling fee recovered at checkout (ORDER_FEE_USD in print-spec).
  const feeCents = Math.round(ORDER_FEE_USD * 100)
  params.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount')
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(feeCents))
  params.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd')
  params.set('shipping_options[0][shipping_rate_data][display_name]', 'Shipping & handling (Printful)')
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][unit]', 'business_day')
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][minimum][value]', '3')
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][unit]', 'business_day')
  params.set('shipping_options[0][shipping_rate_data][delivery_estimate][maximum][value]', '10')

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  })

  const data = await stripeRes.json()

  if (!stripeRes.ok) {
    return json(
      { error: data?.error?.message || 'Stripe error', detail: data?.error },
      stripeRes.status,
    )
  }

  return json({ sessionId: data.id, url: data.url })
}
