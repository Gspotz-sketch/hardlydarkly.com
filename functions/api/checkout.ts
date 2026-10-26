// Cloudflare Pages Function — creates the Stripe Checkout session for the $2.99 unlock.
// Env required on the Pages project: STRIPE_SECRET_KEY (sk_test_… then sk_live_…).
import Stripe from 'stripe'

export async function onRequestPost(context: { request: Request; env: Record<string, string> }) {
  const { request, env } = context
  if (!env.STRIPE_SECRET_KEY) {
    return Response.json({ error: 'payments_not_configured' }, { status: 503 })
  }

  let slug = 'chapter-19'
  try {
    const body = await request.json<{ slug?: string }>()
    slug = typeof body.slug === 'string' && /^[a-z0-9-]+$/.test(body.slug) ? body.slug : slug
  } catch {
    // default slug
  }

  const origin = new URL(request.url).origin
  const stripe = new Stripe(env.STRIPE_SECRET_KEY)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: 299,
          product_data: {
            name: 'Hardly Darkly — Chapters 19–28 (Adult Transmission)',
            description: 'One-time unlock of the adult chapters. Reader access, no ebook.',
          },
        },
      },
    ],
    success_url: `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}#/read/${slug}`,
    cancel_url: `${origin}/#/read/${slug}`,
  })

  return Response.json({ url: session.url })
}
