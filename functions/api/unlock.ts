// Cloudflare Pages Function — checks an unlock code for the $2.99 adult-chapter door.
// Codes live in the Pages project env var UNLOCK_CODES (comma-separated), e.g.:
//   UNLOCK_CODES="EMBER-4F2K-88,ASHEN-9Q1L-77"
// Mint codes locally, hand them to buyers after their Cash App payment lands.
export async function onRequestPost(context: { request: Request; env: Record<string, string> }) {
  const { request, env } = context
  const codes = (env.UNLOCK_CODES ?? '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)

  if (codes.length === 0) {
    return Response.json({ ok: false, error: 'codes_not_configured' }, { status: 503 })
  }

  let code = ''
  try {
    const body = await request.json<{ code?: string }>()
    code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
  } catch {
    code = ''
  }

  if (!code) {
    return Response.json({ ok: false }, { status: 400 })
  }

  const ok = codes.some((valid) => valid.length === code.length && valid === code)
  return Response.json({ ok }, { status: ok ? 200 : 403 })
}
