/**
 * Google AdSense loader (auto ads), gated by route.
 *
 * IMPORTANT (policy): AdSense must not serve on the adult chapters (19–28) —
 * adult content is against AdSense policy and can get the account banned.
 * So the script is injected on public surfaces and removed on adult routes.
 *
 * Requires VITE_ADSENSE_CLIENT env (the ca-pub-… id) at build time.
 */

const CLIENT: string | undefined = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined

const ADS_ID = 'hd-adsense-script'

function inject() {
  if (!CLIENT || document.getElementById(ADS_ID)) return
  const script = document.createElement('script')
  script.id = ADS_ID
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`
  document.head.appendChild(script)
}

function remove() {
  document.getElementById(ADS_ID)?.remove()
  // Auto ads keep their slots via the loader; a reload clears residual state.
}

/** Call on every route change. `allowAds` = route is safe for monetization. */
export function syncAds(allowAds: boolean) {
  if (allowAds) {
    inject()
  } else {
    remove()
  }
}
