// Confirms an adult-verification checkout actually paid before the SPA opens the door.
// POST /api/verify-payment  { sessionId: 'cs_live_…' }  →  { ok: true|false }
//
// The success URL carries the session id (?verified=…); anyone could paste a
// random id, so this endpoint re-checks the session server-side with Stripe:
// payment_status must be 'paid' and the amount must be exactly the $3.00 fee.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export async function onRequestPost(context) {
  const { env, request } = context

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: 'Server misconfiguration: STRIPE_SECRET_KEY missing' }, 500)
  }

  let sessionId = ''
  try {
    const body = await request.json()
    sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : ''
  } catch {
    sessionId = ''
  }

  const looksValid = /^cs_(live|test)_[A-Za-z0-9]{10,}$/.test(sessionId)
  if (!looksValid) {
    return json({ ok: false, error: 'invalid_session_id' }, 400)
  }

  const stripeRes = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  })

  if (!stripeRes.ok) {
    // Unknown/expired session ids land here too — treat as unpaid, don't 500.
    return json({ ok: false }, 200)
  }

  const session = await stripeRes.json()
  const ok =
    session.payment_status === 'paid' &&
    session.amount_total === 300 &&
    session.currency === 'usd'

  return json({ ok }, 200)
}
