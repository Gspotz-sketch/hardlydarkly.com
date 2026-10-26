// Cloudflare Pages Function — verifies a Stripe Checkout session is paid.
// Used on the success redirect and by the "restore purchase" flow.
import Stripe from 'stripe'

export async function onRequestPost(context: { request: Request; env: Record<string, string> }) {
  const { request, env } = context
  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'payments_not_configured' }, { status: 503 })
  }

  let sessionId = ''
  try {
    const body = await request.json<{ session_id?: string }>()
    sessionId = typeof body.session_id === 'string' ? body.session_id : ''
  } catch {
    sessionId = ''
  }
  if (!sessionId.startsWith('cs_')) {
    return Response.json({ paid: false }, { status: 400 })
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY)
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  return Response.json({ paid: session.payment_status === 'paid' })
}
