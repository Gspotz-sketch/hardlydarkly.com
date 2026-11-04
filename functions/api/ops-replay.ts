// Ops console: manually re-run fulfillment for a flagged payment.
// POST /api/ops-replay  { key: <TRACK_ADMIN_KEY>, extId: "hd-XXXX" }
//
// Exists because retries stop: once Stripe has delivered its final retry,
// no new notification will ever arrive. Recovery cannot depend on the
// provider — this endpoint re-invokes the fulfillment pipeline directly,
// using the parameters recorded on the pf-failed-<extId> ledger entry.
// FULFILL_DRY_RUN is honored: a dry replay never writes a real order.

import { fulfillOrder } from '../_shared/fulfill'

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export async function onRequestPost(context) {
  const { env, request } = context
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!env.TRACK_ADMIN_KEY || body?.key !== env.TRACK_ADMIN_KEY) {
    return json({ error: 'unauthorized' }, 401)
  }
  const extId = String(body?.extId || '')
  if (!extId || extId.length > 32) {
    return json({ error: 'extId required (≤32 chars)' }, 400)
  }

  const raw = await env.ORDER_TRACKING.get(`pf-failed-${extId}`)
  if (!raw) {
    return json({ error: `No pf-failed record for ${extId}` }, 404)
  }
  let rec
  try {
    rec = JSON.parse(raw)
  } catch {
    return json({ error: 'pf-failed record unreadable' }, 500)
  }
  if (!rec.productId || !rec.recipient) {
    return json({ error: 'pf-failed record missing replay fields', record: rec }, 422)
  }

  const result = await fulfillOrder(env, {
    extId,
    productId: rec.productId,
    productName: rec.productName || `Replay ${rec.productId}`,
    amountTotalCents: rec.amountTotalCents ?? 0,
    recipient: rec.recipient,
  })

  if (!result.ok) {
    // Still failing: record stays (re-flagged by the pipeline), we surface it.
    return json({ replay: 'failed', error: result.error, detail: result.detail }, result.status)
  }
  if (!result.duplicate) {
    await env.ORDER_TRACKING.delete(`pf-failed-${extId}`)
  }
  return json({ replay: result.duplicate ? 'already-fulfilled' : 'fulfilled', result })
}
