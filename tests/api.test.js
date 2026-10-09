// End-to-end API tests. Run against a running server (npm run dev), using its database:
//   npm test                       (defaults to http://localhost:3001)
//   API_URL=https://dev.linqsafe.com npm test
// Each run signs up fresh qa_* users, so it's safe to repeat. Don't point it at production.
// Test accounts deliberately use @example.com: that domain is reserved, so no real inbox gets their emails.
import { after, test } from 'node:test'
import assert from 'node:assert/strict'

const BASE = (process.env.API_URL || 'http://localhost:3001') + '/api'
const rand = () => Math.random().toString(36).slice(2, 8)
const created = []

// Delete every account this run created (and, by cascade, its links, visits and payments),
// so test runs never show up as real users in the founder dashboard. Local runs only.
after(async () => {
  if (process.env.API_URL || !created.length) return pool?.end()
  await (await db()).query("DELETE FROM users WHERE username IN (?) AND email LIKE '%@example.com'", [created])
  await pool.end()
})

// Tiny client that keeps cookies like a browser would.
function client(ua = 'Mozilla/5.0 (Macintosh) qa-test') {
  const jar = new Map()
  return async (method, path, body) => {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'User-Agent': ua, Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body && JSON.stringify(body),
    })
    for (const c of res.headers.getSetCookie?.() || []) {
      const [pair] = c.split(';')
      const [k, v] = pair.split('=')
      if (v) jar.set(k, v); else jar.delete(k)
    }
    const text = await res.text()
    let json = {}
    try { json = JSON.parse(text) } catch {}
    return { status: res.status, body: json, text, type: res.headers.get('content-type') || '', jar }
  }
}

async function signUp(api, { verified = true } = {}) {
  const username = `qa_${rand()}`
  created.push(username)
  const r = await api('POST', '/register', { username, email: `${username}@example.com`, password: 'secret123' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  // Pages only go public once the email is confirmed; mark it confirmed directly (no inbox in tests).
  if (verified) await (await db()).query('UPDATE users SET email_verified = 1, page_live = 1 WHERE username = ?', [username])
  return username
}
let pool
const db = async () => (pool ??= (await import('../server/db.js')).pool)

test('health check', async () => {
  const r = await client()('GET', '/health')
  assert.deepEqual(r.body, { ok: true })
})

test('sign-up validation', async () => {
  const api = client()
  assert.equal((await api('POST', '/register', { username: 'x', email: 'a@b.co', password: 'secret123' })).status, 400)
  assert.equal((await api('POST', '/register', { username: `qa_${rand()}`, email: 'nope', password: 'secret123' })).status, 400)
  assert.equal((await api('POST', '/register', { username: `qa_${rand()}`, email: `${rand()}@example.com`, password: '123' })).status, 400)
  assert.equal((await api('POST', '/register', { username: 'admin', email: `${rand()}@example.com`, password: 'secret123' })).status, 400)
})

test('session cookie: sign up, me, log out, log in by email', async () => {
  const api = client()
  const username = await signUp(api)
  const me = await api('GET', '/me')
  assert.equal(me.status, 200)
  assert.equal(me.body.username, username)
  assert.equal(me.body.plan, 'free')
  assert.equal(me.body.onboarded_at, null)
  assert.ok(me.body.last_login_at)
  assert.equal((await api('POST', '/logout')).status, 200)
  assert.equal((await api('GET', '/me')).status, 401)
  assert.equal((await api('POST', '/login', { email: `${username}@example.com`, password: 'wrong' })).status, 401)
  assert.equal((await api('POST', '/login', { username, password: 'secret123' })).status, 400, 'usernames are not accepted for log-in')
  assert.equal((await api('POST', '/login', { email: `${username}@example.com`, password: 'secret123' })).status, 200)
  assert.equal((await api('GET', '/me')).status, 200)
})

test('links: type detection rules and the free limit', async () => {
  const api = client()
  await signUp(api)
  const fake = await api('POST', '/links', { title: 'Fake', url: 'https://evil.example/login', type: 'instagram' })
  assert.equal(fake.status, 400, 'a social badge must match the real domain')
  const ok = await api('POST', '/links', { title: 'Insta', url: 'https://www.instagram.com/qa', type: 'instagram' })
  assert.equal(ok.status, 200)
  assert.equal(ok.body.type, 'instagram')
  await api('POST', '/links', { title: 'Two', url: 'https://example.com/2' })
  await api('POST', '/links', { title: 'Three', url: 'https://example.com/3' })
  const fourth = await api('POST', '/links', { title: 'Four', url: 'https://example.com/4' })
  assert.equal(fourth.status, 402)
  assert.equal(fourth.body.upgrade, true)
})

test('paid features are refused until unlocked', async () => {
  const api = client()
  await signUp(api)
  assert.equal((await api('PUT', '/profile', { display_name: 'QA', layout: 'cover' })).status, 402)
  assert.equal((await api('PUT', '/note', { body: 'hello' })).status, 402)
  assert.equal((await api('PUT', '/testimonials', { items: ['great'] })).status, 402)
})

test('business profile + WhatsApp validation', async () => {
  const api = client()
  const username = await signUp(api)
  assert.equal((await api('PUT', '/profile', { display_name: 'QA', account_type: 'business', category: 'beauty', whatsapp: '12' })).status, 400)
  assert.equal((await api('PUT', '/profile', { display_name: 'QA', account_type: 'business', category: 'beauty', whatsapp: '2348012345678' })).status, 200)
  const pub = await client()('GET', `/u/${username}`)
  assert.equal(pub.body.whatsapp, '2348012345678')
  assert.equal(pub.body.plan, undefined, 'plan is not exposed publicly')
  assert.equal(pub.body.email, undefined, 'email is not exposed publicly')
})

test('onboarding completes once', async () => {
  const api = client()
  await signUp(api)
  assert.equal((await api('POST', '/onboarding/complete')).status, 200)
  assert.ok((await api('GET', '/me')).body.onboarded_at)
})

test('analytics: cookie-free unique visitors, owner and bots excluded', async () => {
  const owner = client()
  const username = await signUp(owner)
  const link = await owner('POST', '/links', { title: 'Site', url: 'https://example.com' })

  await owner('GET', `/u/${username}`) // owner's own view: not counted
  await client('Googlebot/2.1')('GET', `/u/${username}`) // bot: not counted
  const a = client('Mozilla/5.0 (iPhone)')
  await a('GET', `/u/${username}?ref=${encodeURIComponent('https://www.instagram.com/')}`)
  await a('GET', `/u/${username}`) // refresh within 30 min: not counted again
  await client('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')('GET', `/u/${username}?tz=Africa%2FLagos`) // second visitor, in Nigeria
  await client('Mozilla/5.0 (Macintosh)')('GET', `/u/${username}`) // third visitor: no cookie or consent needed
  await a('POST', `/click/${link.body.id}`, { ref: '' })

  const s = await owner('GET', '/analytics?days=7')
  assert.equal(s.status, 200)
  assert.equal(s.body.views, 3)
  assert.equal(s.body.visitors, 3)
  assert.equal(s.body.clicks, 1)
  assert.deepEqual(s.body.referrers.find((r) => r.name === 'instagram.com')?.n, 1)
  assert.equal(s.body.series.length, 7)
  assert.equal(s.body.countries.find((c) => c.name === 'NG')?.n, 1, 'country falls back to the browser time zone')
  assert.equal((await owner('GET', '/analytics?days=90')).status, 402, '90-day analytics is a paid feature')
  assert.equal(s.body.audience.total, 3)
  assert.equal(s.body.links[0].n, 1)

  const csv = await owner('GET', '/analytics/export.csv?days=7')
  assert.equal(csv.status, 200)
  assert.match(csv.type, /text\/csv/)
  const lines = csv.text.trim().split('\n')
  assert.equal(lines.length, 5, 'header + 3 views + 1 click')
})

test('account email can be added or changed (needed for payments)', async () => {
  const api = client()
  await signUp(api)
  assert.equal((await api('POST', '/account/email', { email: 'not-an-email' })).status, 400)
  const mail = `qa_${rand()}@example.com`
  const r = await api('POST', '/account/email', { email: mail })
  assert.equal(r.status, 200)
  const me = await api('GET', '/me')
  assert.equal(me.body.email, mail)
  assert.equal(!!me.body.email_verified, false, 'a changed email starts unconfirmed')
})

test('founder dashboard is closed to normal users', async () => {
  const api = client()
  await signUp(api)
  assert.equal((await api('GET', '/owner/stats')).status, 403)
  assert.equal((await client()('GET', '/owner/stats')).status, 401)
  assert.equal((await api('GET', '/owner/traffic')).status, 403)
  assert.equal((await api('GET', '/owner/export/users.csv')).status, 403)
})

test('paid features: catalog, checkout validation, signed webhooks only', async () => {
  const api = client()
  await signUp(api)
  const me = await api('GET', '/me')
  assert.deepEqual(me.body.features, {}, 'a new account has no paid features')
  const cfg = await api('GET', '/billing/config')
  assert.deepEqual(cfg.body.durations, [1, 3, 6, 12])
  assert.ok(cfg.body.features.some((f) => f.key === 'unlimited_links'))
  for (const f of cfg.body.features) for (const m of [1, 3, 6, 12]) assert.equal(typeof f.prices[m], 'number')
  assert.equal((await api('POST', '/billing/checkout', { feature: 'nope', months: 1 })).status, cfg.body.enabled ? 400 : 503)
  assert.equal((await api('POST', '/billing/checkout', { feature: 'qr_code', months: 2 })).status, cfg.body.enabled ? 400 : 503)
  const hook = await fetch(`${BASE}/billing/webhook`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-paystack-signature': 'bad' }, body: '{"event":"charge.success"}' })
  assert.equal(hook.status, 401, 'unsigned webhooks are rejected')
  assert.equal((await api('GET', '/owner/pricing')).status, 403, 'only the founder can see/edit prices')
  assert.equal((await api('PUT', '/owner/pricing', { prices: { qr_code: 1 } })).status, 403)
})

test('a page is a 404 until its owner confirms their email', async () => {
  const owner = client()
  const username = await signUp(owner, { verified: false })
  assert.equal((await client()('GET', `/u/${username}`)).status, 404)
  const own = await owner('GET', `/u/${username}`)
  assert.equal(own.status, 404)
  assert.match(own.body.error, /verify your email/i)
  await (await db()).query('UPDATE users SET email_verified = 1, page_live = 1 WHERE username = ?', [username])
  assert.equal((await client()('GET', `/u/${username}`)).status, 200)
})

test('username change: free first time, then a wait', async () => {
  const api = client()
  const username = await signUp(api)
  const next = `${username}x`.slice(0, 32)
  created.push(next)
  const r = await api('PUT', '/username', { username: next })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.ok(r.body.next_change_at)
  assert.equal((await api('PUT', '/username', { username: `${username}y`.slice(0, 32) })).status, 429)
  assert.equal((await api('GET', '/me')).body.username, next)
  assert.equal((await api('GET', '/me')).body.id, undefined, 'internal ids stay on the server')
})

test('redirect mode and link logos', async () => {
  const api = client()
  const username = await signUp(api)
  const link = (await api('POST', '/links', { title: 'Shop', url: 'https://example.com/shop' })).body
  const other = await signUp(client())
  const theirs = (await client()('GET', `/u/${other}`)).body
  assert.equal(theirs.redirect, null)
  assert.equal((await api('PUT', '/redirect', { link_id: 999999999 })).status, 400, "can't redirect to someone else's link")
  assert.equal((await api('PUT', '/redirect', { link_id: link.id })).status, 200)
  const pub = (await client()('GET', `/u/${username}`)).body
  assert.equal(pub.redirect.url, 'https://example.com/shop')
  assert.equal(pub.own, false)
  assert.equal((await api('GET', `/u/${username}`)).body.own, true)
  await api('PUT', '/redirect', { link_id: null })
  assert.equal((await client()('GET', `/u/${username}`)).body.redirect, null)

  const icon = 'data:image/png;base64,iVBORw0KGgo='
  assert.equal((await api('PUT', `/links/${link.id}`, { title: 'Shop', url: 'https://example.com/shop', icon_url: 'javascript:alert(1)' })).status, 400)
  assert.equal((await api('PUT', `/links/${link.id}`, { title: 'Shop', url: 'https://example.com/shop', icon_url: icon })).status, 200)
  // Public pages get a short cacheable address for the picture, not the picture itself.
  const pubIcon = (await client()('GET', `/u/${username}`)).body.links[0].icon_url
  assert.match(pubIcon, /^\/api\/img\/link\/\d+\?v=[0-9a-f]+$/)
  const img = await fetch(BASE.replace(/\/api$/, '') + pubIcon)
  assert.equal(img.status, 200)
  assert.equal(img.headers.get('content-type'), 'image/png')
  assert.match(img.headers.get('cache-control'), /immutable/)
  assert.equal((await api('GET', '/me')).body.links[0].icon_url, icon, 'the dashboard still gets the picture itself')
})

test('hidden links, click allowance, and founder-only gifting', async () => {
  const api = client()
  const username = await signUp(api)
  const a = (await api('POST', '/links', { title: 'Shown', url: 'https://example.com/a' })).body
  const b = (await api('POST', '/links', { title: 'Hidden', url: 'https://example.com/b' })).body
  assert.equal((await api('PUT', `/links/${b.id}`, { title: 'Hidden', url: 'https://example.com/b', is_public: 0 })).status, 200)
  const pub = (await client()('GET', `/u/${username}`)).body
  assert.deepEqual(pub.links.map((l) => l.title), ['Shown'])
  assert.equal((await api('GET', '/me')).body.links.length, 2, 'the owner still sees hidden links')

  // Free allowance: 1 counted click a month, then clicks stop counting (the link still works).
  const pool = await db()
  const [[before]] = await pool.query("SELECT value FROM app_settings WHERE name = 'FREE_CLICKS'")
  await pool.query("INSERT INTO app_settings (name, value) VALUES ('FREE_CLICKS', '1') ON DUPLICATE KEY UPDATE value = '1'")
  try {
    await client('Mozilla/5.0 (iPhone) one')('POST', `/click/${a.id}`, { ref: '' })
    await client('Mozilla/5.0 (Android) two')('POST', `/click/${a.id}`, { ref: '' })
    const me = (await api('GET', '/me')).body
    assert.equal(me.clicks_this_month, 1)
    assert.equal(me.limits.clicks, 1)
  } finally {
    if (before) await pool.query("UPDATE app_settings SET value = ? WHERE name = 'FREE_CLICKS'", [before.value])
    else await pool.query("DELETE FROM app_settings WHERE name = 'FREE_CLICKS'")
  }

  assert.equal((await api('POST', `/owner/users/${username}/features`, { feature: 'qr_code', months: 1 })).status, 403)
  assert.equal((await api('GET', '/owner/users')).status, 403)
})

test('loophole fixes: old usernames held and forwarded, email change keeps the page live, big logos fit', async () => {
  const api = client()
  const username = await signUp(api)
  const next = `${username}z`.slice(0, 32)
  created.push(next)
  assert.equal((await api('PUT', '/username', { username: next })).status, 200)
  // The old name forwards for 90 days and nobody else can take it.
  assert.deepEqual((await client()('GET', `/u/${username}`)).body, { moved_to: next })
  assert.equal((await client()('GET', `/username/${username}`)).body.available, false)
  assert.equal((await client()('POST', '/register', { username, email: `${username}2@example.com`, password: 'secret123' })).status, 409)

  // Changing email (unverified until clicked) doesn't take a live page offline.
  assert.equal((await api('POST', '/account/email', { email: `${next}.new@example.com` })).status, 200)
  assert.ok(!(await api('GET', '/me')).body.email_verified)
  assert.equal((await client()('GET', `/u/${next}`)).status, 200)

  // A ~40 KB logo upload is accepted (the links API allows up to 100 KB bodies).
  const link = (await api('POST', '/links', { title: 'Shop', url: 'https://example.com/shop' })).body
  const big = 'data:image/png;base64,' + 'A'.repeat(40_000)
  assert.equal((await api('PUT', `/links/${link.id}`, { title: 'Shop', url: 'https://example.com/shop', icon_url: big })).status, 200)
})
