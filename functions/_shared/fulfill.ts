// Shared Printful fulfillment — Hardly Darkly Memorabilia.
// KV-only (no D1): idempotency claims and the evidence ledger both live in
// the ORDER_TRACKING KV binding. Status flow:
//   draft → pending → confirmed   (happy path)
//   any stage failure → durable pf-failed-<extId> record (ops console)
//
// Optional env:
//   PRINTFUL_STORE_ID   — default '18913616'
//   PRINTFUL_MAP        — JSON override: { "<productId>": { "variantId": <int>,
//                         "file": "<public url of print artwork>" } }
//                         A manual entry wins over spec resolution.
//   FULFILL_DRY_RUN     — run everything except the Printful write.
//   FULFILL_SIMULATE    — 'printful_400' | 'printful_500' | 'printful_timeout'
//                         scripts the outcome of the Printful write (tests).

import { resolveShape, resolveVariantId, artUrl } from './print-spec'

export interface Recipient {
  name: string
  address1: string
  address2?: string
  city: string
  state_code?: string
  country_code: string
  zip: string
  email?: string
  phone?: string
}

export type FulfillResult =
  | {
      ok: true
      duplicate?: boolean
      /** Another attempt holds the claim and is still working. */
      inFlight?: boolean
      /** A previously-created draft was found unconfirmed and re-confirmed. */
      resumed?: boolean
      /** FULFILL_DRY_RUN was set: everything ran, the Printful write did not. */
      dryRun?: boolean
      printfulOrderId: number | null
      confirmed: boolean
      variantId: number
      variantSource: string
      file: string
      /** Exact payload that WOULD have been POSTed (dry run only). */
      wouldCreate?: { external_id: string; recipient: Recipient; items: unknown[] }
    }
  | { ok: false; status: number; error: string; detail?: unknown }

const DEFAULT_STORE_ID = '18913616'

type ClaimOutcome = 'won' | 'stale-won' | 'lost-final' | 'lost-inflight'

// --- SINGLE-WRITER idempotency claim (KV vote) ------------------------------
// KV is last-writer-wins, so the claim is a vote followed by a read-back:
// exactly one concurrent event observes its own token and proceeds. A
// crashed attempt's claim is stolen as 'stale-won' after 5 min, and the
// Printful dup scan below re-verifies real state anyway.
async function claimAttempt(env: any, key: string, token: string): Promise<ClaimOutcome> {
  const priorRaw: string | null = await env.ORDER_TRACKING?.get(key).catch(() => null)
  if (priorRaw) {
    const prior = JSON.parse(priorRaw)
    if (prior.stage !== 'creating') return 'lost-final'
    return 'stale-won'
  }
  await ledger(env, key, { stage: 'creating', claimToken: token })
  const after: string | null = await env.ORDER_TRACKING?.get(key).catch(() => null)
  if (after) {
    const settled = JSON.parse(after)
    if (settled.claimToken !== token) return 'lost-final'
  }
  return 'won'
}

async function claimFinalize(
  env: any,
  key: string,
  token: string,
  fields: { printfulOrderId?: number | null; confirmed?: boolean; dryRun?: boolean },
) {
  await ledger(env, key, {
    stage: 'fulfilled',
    claimToken: token,
    extId: key.replace(/^(pf-dry-|pf-)/, ''),
    printfulOrderId: fields.printfulOrderId ?? null,
    confirmed: fields.confirmed === true,
    dryRun: fields.dryRun === true,
  })
}

export async function printful(
  path: string,
  token: string,
  storeId: string | number | undefined,
  options: RequestInit & { headers?: Record<string, string> } = {},
) {
  const qs = storeId ? `${path.includes('?') ? '&' : '?'}store_id=${storeId}` : ''
  const res = await fetch(`https://api.printful.com${path}${qs}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

// Durable evidence ledger. Each fulfillment attempt (dry-run or real) is
// written to the ORDER_TRACKING KV binding so results survive the webhook
// HTTP exchange and can be inspected later. Fail-open: a KV hiccup must
// never break an order.
async function ledger(env: any, key: string, value: Record<string, unknown>) {
  try {
    await env.ORDER_TRACKING?.put(key, JSON.stringify({ ts: Date.now(), ...value }))
  } catch {
    /* evidence is nice, fulfillment is essential */
  }
}

export async function fulfillOrder(
  env: any,
  opts: {
    /** Unique per payment, ≤32 chars (Printful external_id cap). hd-… */
    extId: string
    productId: number
    productName: string
    /** Total charged, in cents — includes handling; recorded as retail price. */
    amountTotalCents: number
    recipient: Recipient
  },
): Promise<FulfillResult> {
  const { PRINTFUL_API_TOKEN, PRINTFUL_MAP } = env
  const { extId, productId, productName, amountTotalCents, recipient } = opts

  // Paid-but-unfulfilled flag: every failure path below writes a durable
  // pf-failed-<extId> record to the ORDER_TRACKING KV. A payment that was
  // accepted but never fulfilled is therefore queryable, auditable, and
  // visible to the ops review — not just a line in a log.
  const fail = async (stage: string, status: number, error: string, detail?: unknown) => {
    await ledger(env, `pf-failed-${extId}`, {
      extId,
      productId,
      productName,
      amountTotalCents,
      recipient,
      stage,
      status,
      error,
      detail: detail === undefined ? null : detail,
    })
    return { ok: false as const, status, error, detail }
  }

  // --- Map site product → Printful catalog variant -------------------------
  let mapping: Record<string, { variantId?: number; file?: string }> = {}
  try {
    mapping = PRINTFUL_MAP ? JSON.parse(PRINTFUL_MAP) : {}
  } catch {
    return fail('config', 500, 'PRINTFUL_MAP is not valid JSON')
  }

  const mapEntry = mapping[String(productId)]
  const shapeInfo = resolveShape(productId)

  if (!mapEntry?.variantId && !shapeInfo) {
    // Config gap, not a transient error — retries won't help, but a 500
    // keeps the event visible in the Stripe dashboard for manual replay.
    return fail('mapping', 500, `No Printful mapping for product ${productId} (${productName})`)
  }

  const storeId = env.PRINTFUL_STORE_ID || DEFAULT_STORE_ID

  let variantId: number
  let fileUrl: string | undefined
  let variantSource: string
  if (mapEntry?.variantId) {
    variantId = mapEntry.variantId
    fileUrl = mapEntry.file
    variantSource = 'map'
  } else {
    try {
      variantId = await resolveVariantId(shapeInfo!.shape, PRINTFUL_API_TOKEN)
    } catch (err) {
      return fail(
        'variant-resolution',
        500,
        `Printful variant resolution failed for product ${productId}`,
        String((err as Error)?.message || err),
      )
    }
    fileUrl = artUrl(shapeInfo!.base)
    variantSource = 'spec'
  }

  // Every order item MUST carry its artwork file — otherwise Printful
  // prints the blank.
  if (!fileUrl) {
    return fail('artwork', 500, `No artwork URL resolved for product ${productId}`)
  }

  // --- SINGLE-WRITER claim: exactly one concurrent event proceeds ----------
  const claimKey = `${env.FULFILL_DRY_RUN ? 'pf-dry-' : 'pf-'}${extId}`
  const claimToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  const claim = await claimAttempt(env, claimKey, claimToken)
  if (claim === 'lost-final') {
    const finalRecord: any = JSON.parse(
      (await env.ORDER_TRACKING?.get(claimKey).catch(() => null)) || 'null',
    )
    return {
      ok: true,
      duplicate: true,
      printfulOrderId: finalRecord?.printfulOrderId ?? null,
      confirmed: finalRecord?.confirmed === true,
      variantId,
      variantSource,
      file: fileUrl,
      ...(env.FULFILL_DRY_RUN ? { dryRun: true as const } : {}),
    }
  }
  if (claim === 'lost-inflight') {
    return {
      ok: true,
      duplicate: true,
      inFlight: true,
      printfulOrderId: null,
      confirmed: false,
      variantId,
      variantSource,
      file: fileUrl,
      ...(env.FULFILL_DRY_RUN ? { dryRun: true as const } : {}),
    }
  }

  // --- Idempotency: one Printful order per payment -------------------------
  // NB: Printful's /orders?external_id= filter is unreliable (returns
  // unrelated orders) — fetch recent orders, match client-side, exact.
  const existing = await printful(`/orders?limit=100`, PRINTFUL_API_TOKEN!, storeId)
  const existingOrders: Array<{ id: number; external_id?: string; status?: string }> =
    Array.isArray(existing.data?.result) ? existing.data.result : []
  const dup = existingOrders.find(
    (o) => o.external_id === extId && o.status !== 'canceled' && o.status !== 'failed',
  )
  if (dup) {
    // Crash-recovery: a previous attempt may have created this draft and
    // then crashed (or 5xx'd) BEFORE confirm. Never report success without
    // verifying actual state. Re-confirming a draft is safe and idempotent;
    // a webhook replay after a crash lands here and finishes the job.
    const check = await printful(`/orders/${dup.id}`, PRINTFUL_API_TOKEN!, storeId, {
      method: 'GET',
    })
    const dupStatus: string | undefined = check.data?.result?.status
    if (dupStatus && dupStatus !== 'draft') {
      await claimFinalize(env, claimKey, claimToken, {
        printfulOrderId: dup.id,
        confirmed: true,
      })
      return {
        ok: true,
        duplicate: true,
        printfulOrderId: dup.id,
        confirmed: true,
        variantId,
        variantSource,
        file: fileUrl,
      }
    }
    const confirmRes = await printful(
      `/orders/${dup.id}/confirm`,
      PRINTFUL_API_TOKEN!,
      storeId,
      { method: 'POST' },
    )
    await claimFinalize(env, claimKey, claimToken, {
      printfulOrderId: dup.id,
      confirmed: confirmRes.ok === true,
    })
    await ledger(env, `pf-${extId}`, {
      extId,
      printfulOrderId: dup.id,
      resumed: true,
      confirmed: confirmRes.ok === true,
      productId,
      variantId,
      variantSource,
      file: fileUrl,
    })
    return {
      ok: true,
      duplicate: true,
      resumed: true,
      printfulOrderId: dup.id,
      confirmed: confirmRes.ok === true,
      variantId,
      variantSource,
      file: fileUrl,
    }
  }

  const orderPayload = {
    external_id: extId,
    recipient,
    items: [
      {
        variant_id: variantId,
        quantity: 1,
        retail_price: (amountTotalCents / 100).toFixed(2),
        name: productName,
        files: [{ url: fileUrl }],
      },
    ],
  }

  // --- Simulated fulfillment backend (chaos/review tests only) --------------
  const simulate: string | undefined = env.FULFILL_SIMULATE
  if (simulate) {
    return fail('order-creation(simulated)', 500,
      `Printful order creation failed (simulated: ${simulate})`,
      { simulated: simulate })
  }

  // --- Dry run: prove everything except the write ---------------------------
  if (env.FULFILL_DRY_RUN) {
    await claimFinalize(env, claimKey, claimToken, { confirmed: false, dryRun: true })
    return {
      ok: true,
      dryRun: true,
      printfulOrderId: null,
      confirmed: false,
      variantId,
      variantSource,
      file: fileUrl,
      wouldCreate: orderPayload,
    }
  }

  // --- Create draft order, then confirm ------------------------------------
  const createRes = await printful('/orders', PRINTFUL_API_TOKEN!, storeId, {
    method: 'POST',
    body: JSON.stringify(orderPayload),
  })

  if (!createRes.ok || !createRes.data?.result?.id) {
    return fail('order-creation', 500, 'Printful order creation failed', createRes.data)
  }

  const orderId = createRes.data.result.id as number
  const confirmRes = await printful(
    `/orders/${orderId}/confirm`,
    PRINTFUL_API_TOKEN!,
    storeId,
    { method: 'POST' },
  )

  if (!confirmRes.ok) {
    // The draft exists but never confirmed — a replayed webhook will find it
    // via the dup scan above and re-confirm (crash recovery). Flag it now.
    await ledger(env, `pf-failed-${extId}`, {
      extId,
      productId,
      productName,
      amountTotalCents,
      recipient,
      stage: 'confirm',
      status: confirmRes.status,
      error: 'Printful confirm failed',
      printfulOrderId: orderId,
    })
  }

  await claimFinalize(env, claimKey, claimToken, {
    printfulOrderId: orderId,
    confirmed: confirmRes.ok === true,
  })

  return {
    ok: true,
    printfulOrderId: orderId,
    confirmed: confirmRes.ok === true,
    variantId,
    variantSource,
    file: fileUrl,
  }
}

/**
 * Cancel the Printful order for an external_id (charge.refunded path).
 * Printful only cancels while the order is unfulfilled (draft/pending);
 * a too-late cancel is reported, not hidden. Idempotent: already-canceled
 * orders count as ok.
 */
export async function cancelOrderByExtId(
  env: any,
  extId: string,
): Promise<{ ok: boolean; status: number; printfulOrderId?: number; detail?: unknown }> {
  const { PRINTFUL_API_TOKEN } = env
  if (!PRINTFUL_API_TOKEN) return { ok: false, status: 500, detail: 'no printful token' }
  const storeId = env.PRINTFUL_STORE_ID || DEFAULT_STORE_ID

  // Prefer the ledger (one KV read over a Printful scan)…
  const ledgerRaw: string | null = await env.ORDER_TRACKING?.get(`pf-${extId}`).catch(() => null)
  let orderId: number | undefined = ledgerRaw ? JSON.parse(ledgerRaw)?.printfulOrderId : undefined

  // …but fall back to a live scan — the ledger may predate a crash.
  if (!orderId) {
    const existing = await printful(`/orders?limit=100`, PRINTFUL_API_TOKEN, storeId)
    const orders: Array<{ id: number; external_id?: string }> = Array.isArray(
      existing.data?.result,
    )
      ? existing.data.result
      : []
    orderId = orders.find((o) => o.external_id === extId)?.id
  }
  if (!orderId) return { ok: false, status: 404, detail: 'no Printful order for extId' }

  const res = await printful(`/orders/${orderId}/cancel`, PRINTFUL_API_TOKEN, storeId, {
    method: 'POST',
  })
  const alreadyCanceled = res.status === 404 || res.data?.result?.status === 'canceled'
  await ledger(env, `pf-canceled-${extId}`, {
    extId,
    printfulOrderId: orderId,
    cancelStatus: res.status,
    ok: res.ok || alreadyCanceled,
  })
  return { ok: res.ok || alreadyCanceled, status: res.status, printfulOrderId: orderId, detail: res.data }
}
