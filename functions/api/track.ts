// Order tracking-number store for chargeback evidence.
// POST /api/track  { order, tracking, carrier?, note? }  -> saves entry, auto-purges after 90 days
// GET  /api/track?order=XX                             -> one entry (404 if gone)
// GET  /api/track                                    -> all live entries
// Auth: x-admin-key header must match TRACK_ADMIN_KEY env var.
// KV expiration IS the purge: entries vanish 90 days after write, no cron needed.
interface Env {
  ORDER_TRACKING: KVNamespace
  TRACK_ADMIN_KEY: string
}

const TTL = 90 * 24 * 60 * 60 // 90 days, seconds

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

function authed(request: Request, env: Env): boolean {
  return request.headers.get('x-admin-key') === env.TRACK_ADMIN_KEY
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401)
  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid json' }, 400)
  }
  const order = String(body.order || '').trim().toUpperCase()
  const tracking = String(body.tracking || '').trim()
  if (!order || !tracking) return json({ error: 'order and tracking are required' }, 400)

  const entry = {
    order,
    tracking,
    carrier: String(body.carrier || '').trim(),
    note: String(body.note || '').trim(),
    stored_at: new Date().toISOString(),
    purge_at: new Date(Date.now() + TTL * 1000).toISOString().slice(0, 10),
  }
  await env.ORDER_TRACKING.put(order, JSON.stringify(entry), { expirationTtl: TTL })
  return json({ ok: true, ...entry })
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!authed(request, env)) return json({ error: 'unauthorized' }, 401)
  const url = new URL(request.url)
  const order = url.searchParams.get('order')?.trim().toUpperCase()
  if (order) {
    const v = await env.ORDER_TRACKING.get(order)
    return v ? json(JSON.parse(v)) : json({ error: 'not found (purged or never stored)' }, 404)
  }
  // Internal fulfillment-ledger keys (pf-*, pf-failed-*, pf-canceled-*) live
  // in the same namespace; they belong to the ops console, not this view.
  const listed = await env.ORDER_TRACKING.list()
  const items = (
    await Promise.all(
      listed.keys
        .filter((k) => !k.name.startsWith('pf-'))
        .map((k) =>
          env.ORDER_TRACKING.get(k.name).then((v) => {
            try {
              return v ? JSON.parse(v) : null
            } catch {
              return null
            }
          }),
        ),
    )
  ).filter(Boolean)
  items.sort((a, b) => String(b.stored_at || '').localeCompare(String(a.stored_at || '')))
  return json({ count: items.length, auto_purge_days: 90, items })
}
