// TEMPORARY diagnostic — returns NAMES of Printful/Stripe-related env vars only
// (never values). Delete after env setup is confirmed.
export async function onRequestGet(context: { request: Request; env: Record<string, string> }) {
  const { env } = context
  const relevant = Object.keys(env).filter((k) => /printf|stripe|ful|secret|token/i.test(k))
  return Response.json({
    relevant_keys: relevant,
    has_PRINTFUL_API_TOKEN: Boolean(env.PRINTFUL_API_TOKEN),
    has_STRIPE_SECRET_KEY: Boolean(env.STRIPE_SECRET_KEY),
  })
}
