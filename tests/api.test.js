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
  if (process.env.API_URL || !created.length) return
  const { pool } = await import('../server/db.js')
  await pool.query("DELETE FROM users WHERE username IN (?) AND email LIKE '%@example.com'", [created])
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

async function signUp(api) {
  const username = `qa_${rand()}`
  created.push(username)
  const r = await api('POST', '/register', { username, email: `${username}@example.com`, password: 'secret123' })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return username
}

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
  assert.equal((await api('POST', '/login', { username: `${username}@example.com`, password: 'wrong' })).status, 401)
  assert.equal((await api('POST', '/login', { username: `${username}@example.com`, password: 'secret123' })).status, 200)
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

test('analytics: unique visitors with consent, owner and bots excluded', async () => {
  const owner = client()
  const username = await signUp(owner)
  const link = await owner('POST', '/links', { title: 'Site', url: 'https://example.com' })

  await owner('GET', `/u/${username}`) // owner's own view: not counted
  await client('Googlebot/2.1')('GET', `/u/${username}`) // bot: not counted
  const a = client('Mozilla/5.0 (iPhone)')
  await a('GET', `/u/${username}?consent=1&ref=${encodeURIComponent('https://www.instagram.com/')}`)
  await a('GET', `/u/${username}?consent=1`) // refresh within 30 min: not counted again
  await client('Mozilla/5.0 (iPhone)')('GET', `/u/${username}?consent=1&tz=Africa%2FLagos`) // second visitor, in Nigeria
  await client('Mozilla/5.0 (Macintosh)')('GET', `/u/${username}`) // no consent: counted, but not as unique
  await a('POST', `/click/${link.body.id}`, { ref: '', consent: true })

  const s = await owner('GET', '/analytics?days=7')
  assert.equal(s.status, 200)
  assert.equal(s.body.views, 3)
  assert.equal(s.body.visitors, 2)
  assert.equal(s.body.clicks, 1)
  assert.deepEqual(s.body.referrers.find((r) => r.name === 'instagram.com')?.n, 1)
  assert.equal(s.body.series.length, 7)
  assert.equal(s.body.countries.find((c) => c.name === 'NG')?.n, 1, 'country falls back to the browser time zone')
  assert.equal((await owner('GET', '/analytics?days=90')).status, 402, '90-day analytics is a paid feature')
  assert.equal(s.body.audience.total, 2)
  assert.equal(s.body.links[0].n, 1)

  const csv = await owner('GET', '/analytics/export.csv?days=7')
  assert.equal(csv.status, 200)
  assert.match(csv.type, /text\/csv/)
  const lines = csv.text.trim().split('\n')
  assert.equal(lines.length, 5, 'header + 3 views + 1 click')
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
