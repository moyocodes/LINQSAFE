// Paid features. Each is bought for 1, 3, 6 or 12 months; buying again extends it.
// Prices (naira) are set by the founder in the dashboard (/owner → Pricing), with .env as the fallback:
//   PRICE_<FEATURE>   monthly price, e.g. PRICE_UNLIMITED_LINKS=2000. Empty/0 = not for sale yet.
//   DISCOUNT_3M / DISCOUNT_6M / DISCOUNT_12M   optional % off for longer periods, e.g. 10.
// Accounts with plan = 'pro' (set by hand with `npm run set-plan`) have every feature, with no expiry.
export const FEATURES = [
  { key: 'unlimited_links', name: 'Unlimited links', detail: 'Free pages hold 3 links' },
  { key: 'tpl_cover', name: 'Cover template', detail: 'Full photo header' },
  { key: 'tpl_editorial', name: 'Editorial template', detail: 'Paper and serif type' },
  { key: 'tpl_search', name: 'Search & solve template', detail: 'Problem → your answers' },
  { key: 'tpl_idcard', name: 'Profile card template', detail: 'Polaroid and fact sheet' },
  { key: 'tpl_backdrop', name: 'Photo background template', detail: 'Your photo behind the whole page, blurred or sharp' },
  { key: 'founder_note', name: "Founder's note", detail: 'A personal letter on your page' },
  { key: 'testimonials', name: 'Kind words', detail: 'Client messages as chat bubbles' },
  { key: 'qr_code', name: 'QR code download', detail: 'For print, packaging and stories' },
  { key: 'analytics_90', name: '90-day analytics', detail: 'Free analytics cover the last 30 days' },
  { key: 'unlimited_clicks', name: 'Unlimited link clicks', detail: 'Free pages count a set number of link clicks a month' },
  { key: 'scheduled_links', name: 'Scheduled links', detail: 'Pick when each link goes live' },
]
export const DURATIONS = [1, 3, 6, 12] // months
export const FEATURE_KEYS = FEATURES.map((f) => f.key)
export const featureByKey = Object.fromEntries(FEATURES.map((f) => [f.key, f]))
// Which feature each premium template needs.
export const LAYOUT_FEATURE = { cover: 'tpl_cover', editorial: 'tpl_editorial', search: 'tpl_search', idcard: 'tpl_idcard', backdrop: 'tpl_backdrop' }

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0)

// Pricing settings: values saved from the founder dashboard (app_settings table) win; .env is the fallback.
// `saved` is a { PRICE_UNLIMITED_LINKS: '2000', DISCOUNT_3M: '10', … } map loaded from the database.
export function pricing(saved = {}) {
  const read = (name) => (saved[name] != null && saved[name] !== '' ? saved[name] : process.env[name])
  const monthly = (key) => num(read(`PRICE_${key.toUpperCase()}`))
  const discount = (months) => (months === 1 ? 0 : Math.min(90, num(read(`DISCOUNT_${months}M`))))
  // Naira for `months` of a feature, after any discount, rounded to the nearest ₦50. 0 = not for sale.
  const priceFor = (key, months) => {
    const base = monthly(key) * months * (1 - discount(months) / 100)
    return base > 0 ? Math.round(base / 50) * 50 : 0
  }
  const catalog = () => FEATURES.map((f) => ({
    ...f,
    monthly: monthly(f.key),
    forSale: monthly(f.key) > 0,
    prices: Object.fromEntries(DURATIONS.map((m) => [m, priceFor(f.key, m)])),
  }))
  // Free plan allowances, also set by the founder: links per page, and link clicks counted per month (0 = no cap).
  const count = (name, fallback) => { const v = read(name); return v == null || v === '' || !Number.isFinite(Number(v)) ? fallback : Math.max(0, Math.floor(Number(v))) }
  const limits = { links: count('FREE_LINKS', 3), clicks: count('FREE_CLICKS', 0) }
  return { monthly, discount, priceFor, catalog, limits, discounts: Object.fromEntries(DURATIONS.slice(1).map((m) => [m, discount(m)])) }
}
