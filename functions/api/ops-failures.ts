// Ops console: list paid-but-unfulfilled orders.
// GET /api/ops-failures?key=<TRACK_ADMIN_KEY>
// Every fulfillment failure writes a durable pf-failed-<extId> record (see
// _shared/fulfill.ts). This endpoint is the actionable alert surface: an
// external monitor can poll it, and it works even after Stripe has stopped
// delivering notifications.

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export async function onRequestGet(context) {
  const { env, request } = context
  const key = new URL(request.url).searchParams.get('key')
  if (!env.TRACK_ADMIN_KEY || key !== env.TRACK_ADMIN_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }
  const listed = await env.ORDER_TRACKING.list({ prefix: 'pf-failed-' })
  const failures = []
  for (const k of listed.keys || []) {
    const raw = await env.ORDER_TRACKING.get(k.name)
    if (!raw) continue
    try {
      const rec = JSON.parse(raw)
      failures.push({
        extId: rec.extId,
        productId: rec.productId,
        productName: rec.productName,
        stage: rec.stage,
        status: rec.status,
        error: rec.error,
        ts: rec.ts,
        replayable: true,
      })
    } catch {
      failures.push({ key: k.name, parseError: true })
    }
  }
  failures.sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return json({ unresolved: failures.length, failures })
}
