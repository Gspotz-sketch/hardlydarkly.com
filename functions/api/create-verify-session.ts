// Stripe Checkout entry point — adult-section one-time verification.
// POST /api/create-verify-session  →  { url }
// Buyer pays $3.00 once (card, via Stripe) and the door opens instantly —
// no Cash App, no manual keys. Success returns to /?verified={CHECKOUT_SESSION_ID};
// the SPA then calls /api/verify-payment to confirm and set the unlock flag.
//
// Env required: STRIPE_SECRET_KEY (same live key as the memorabilia checkout).

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export async function onRequestPost(context) {
  const { env } = context

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Server misconfiguration: STRIPE_SECRET_KEY missing' }, 500)
  }

  const params = new URLSearchParams({
    mode: 'payment',
    success_url: 'https://hardlydarkly.com/?verified={CHECKOUT_SESSION_ID}',
    cancel_url: 'https://hardlydarkly.com/',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': '300',
    'line_items[0][price_data][product_data][name]': 'Adult Section — One-Time Age Verification',
    'line_items[0][price_data][product_data][description]':
      'One-time $3.00 verification. Grants permanent access to Chapters 19–28 on any device. No subscription.',
    'line_items[0][quantity]': '1',
    // Flag the session so the print webhook ignores it (see stripe-webhook.ts).
    'metadata[hd_type]': 'adult-verification',
  })

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const data = await stripeRes.json()
  if (!stripeRes.ok) {
    console.error('Stripe session create failed', stripeRes.status, data?.error?.message)
    return json({ error: 'Could not start verification checkout' }, 502)
  }
  return json({ url: data.url })
}
