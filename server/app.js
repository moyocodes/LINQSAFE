import 'express-async-errors' // lets async route handlers forward errors to the error middleware (Express 4)
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import ct from 'countries-and-timezones'
import './env.js'
import { pool } from './db.js'
import { send } from './mailer.js'
import * as Email from './emails.js'
import { createSeo, indexable } from './seo.js'
import { createOg } from './og.js'
import { DURATIONS, FEATURES, FEATURE_KEYS, LAYOUT_FEATURE, featureByKey, pricing } from './features.js'

const isProd = process.env.NODE_ENV === 'production'
const SECRET = process.env.JWT_SECRET || 'dev-secret'
if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'change-me')) {
  console.error('Refusing to start: set a strong JWT_SECRET in production.')
  process.exit(1)
}

const app = express()
app.set('trust proxy', 1) // behind a host's reverse proxy; needed for correct client IPs in rate limiting
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'], // https: so profile image links load
        'connect-src': ["'self'", 'https://api.paystack.co'],
        // Paystack's inline checkout runs in an iframe from checkout.paystack.com.
        'frame-src': ['https://checkout.paystack.com', 'https://standard.paystack.co'],
        'frame-ancestors': ["'self'"], // the dashboard previews templates in an iframe; other sites still can't frame linqsafe
      },
    },
  })
)
app.use(compression())
// Same-origin by default. Set CORS_ORIGIN (comma-separated) only if the frontend is hosted elsewhere.
if (process.env.CORS_ORIGIN) app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }))
// ---- Paystack billing: pay once per feature (server/features.js) ----
// A feature unlocks only after the payment is verified with Paystack's API (callback) or a signed
// webhook, never from the redirect alone.
const PAYSTACK_KEY = process.env.PAYSTACK_SECRET_KEY || ''
// Current prices: founder-saved settings over .env defaults. Read fresh each time (tiny table).
async function currentPricing() {
  const [rows] = await pool.query("SELECT name, value FROM app_settings WHERE name LIKE 'PRICE\\_%' OR name LIKE 'DISCOUNT\\_%'")
  return pricing(Object.fromEntries(rows.map((r) => [r.name, r.value])))
}
async function paystack(path, init = {}) {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init, headers: { Authorization: `Bearer ${PAYSTACK_KEY}`, 'Content-Type': 'application/json', ...init.headers },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.status) throw new Error(data.message || `Paystack error ${res.status}`)
  return data.data
}
// "Visa •••• 4081 · Zenith Bank", "Bank transfer · GTBank", …: how the customer paid, for receipts.
function methodLabel(d) {
  const names = { card: 'Card', bank: 'Bank account', bank_transfer: 'Bank transfer', ussd: 'USSD', qr: 'QR', mobile_money: 'Mobile money', apple_pay: 'Apple Pay' }
  const head = d.channel === 'card' && d.last4 ? `${(d.card_type || 'Card').replace(/^\w/, (c) => c.toUpperCase())} •••• ${d.last4}` : names[d.channel] || d.channel || 'Paystack'
  return d.bank ? `${head} · ${d.bank}` : head
}
async function sendReceipt(userId, items, tx, details) {
  setTimeout(async () => { // let the grants commit first so the receipt shows the new end dates
    try {
      const [[u]] = await pool.query('SELECT email, username, display_name, avatar_url FROM users WHERE id = ?', [userId])
      const access = await featureAccess(userId)
      send(u.email, Email.receipt({
        person: Email.personOf(u), name: u.display_name || u.username, amount: tx.amount / 100, reference: tx.reference, method: methodLabel(details),
        date: tx.paid_at || new Date(),
        items: items.map((i) => ({ feature: featureByKey[i.feature]?.name || i.feature, months: i.months, until: access[i.feature] })),
      }), { tag: 'receipt' })
    } catch (e) { console.error('receipt:', e.message) }
  }, 1500)
}

// Records a verified Paystack transaction once (reference is unique) and unlocks the feature it paid for
// for the months bought, stacked on any time left. Returns the feature key, or null if it doesn't check out.
// The features a Paystack transaction paid for: [{ feature, months, price }]. Supports one-feature payments made
// before multi-feature checkout existed (metadata.feature / months / price).
// "Cover template, QR code download" for a payment row (single feature or a bundle).
function paymentName(p) {
  let list = []
  try { list = p.items ? JSON.parse(p.items) : [] } catch { /* ignore */ }
  if (!list.length && p.feature) list = [{ feature: p.feature }]
  return list.map((i) => featureByKey[i.feature]?.name || i.feature).join(', ')
}

function itemsOf(tx) {
  const m = tx.metadata || {}
  const list = Array.isArray(m.items) ? m.items : m.feature ? [{ feature: m.feature, months: m.months, price: m.price }] : []
  return list.map((i) => ({ feature: String(i.feature), months: Number(i.months), price: Number(i.price) || 0 }))
    .filter((i) => featureByKey[i.feature] && DURATIONS.includes(i.months))
}

async function applyPayment(tx) {
  const userId = Number(tx.metadata?.user_id)
  const items = itemsOf(tx)
  if (!userId || !items.length) return null
  // Prices are fixed at checkout (stored in metadata); fall back to today's price for very old payments.
  const pricing = await currentPricing()
  const total = items.reduce((t, i) => t + (i.price || pricing.priceFor(i.feature, i.months)), 0)
  // How they paid, for the founder's payments view and the customer's receipts.
  const a = tx.authorization || {}
  const details = {
    paystack_id: tx.id || null, channel: String(tx.channel || a.channel || '').slice(0, 20),
    card_type: String(a.card_type || '').trim().slice(0, 30), last4: String(a.last4 || '').slice(0, 4),
    bank: String(a.bank || '').slice(0, 80), customer_email: String(tx.customer?.email || '').slice(0, 254),
    gateway_response: String(tx.gateway_response || '').slice(0, 120),
  }
  const paid = tx.status === 'success' && tx.currency === 'NGN' && total > 0 && tx.amount >= total * 100
  const status = paid ? 'success' : tx.status === 'success' ? 'underpaid' : String(tx.status || 'unknown').slice(0, 20)
  const featureCol = items.length === 1 ? items[0].feature : 'bundle'
  const monthsCol = items.every((i) => i.months === items[0].months) ? items[0].months : 0
  // Record/refresh the payment row. `first` is true only for the one request that marks it successful,
  // so the callback and the webhook can't both grant the time.
  const [upd] = await pool.query(
    `UPDATE payments SET status = ?, amount_kobo = ?, paystack_id = ?, channel = ?, card_type = ?, last4 = ?, bank = ?,
       customer_email = ?, gateway_response = ?, items = ?, paid_at = IF(? = 'success', NOW(), paid_at)
     WHERE reference = ? AND status <> 'success'`,
    [status, tx.amount, details.paystack_id, details.channel, details.card_type, details.last4, details.bank,
      details.customer_email, details.gateway_response, JSON.stringify(items), status, tx.reference])
  let first = upd.affectedRows > 0 && status === 'success'
  if (!upd.affectedRows) {
    const [ins] = await pool.query(
      `INSERT IGNORE INTO payments (user_id, reference, amount_kobo, currency, status, feature, months, items, paystack_id, channel, card_type,
         last4, bank, customer_email, gateway_response, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'success', NOW(), NULL))`,
      [userId, tx.reference, tx.amount, tx.currency, status, featureCol, monthsCol, JSON.stringify(items), details.paystack_id, details.channel,
        details.card_type, details.last4, details.bank, details.customer_email, details.gateway_response, status])
    first = ins.affectedRows > 0 && status === 'success'
  }
  if (!paid) return null
  if (first) { // first time this payment succeeded: grant/extend each feature once
    for (const i of items) {
      await pool.query(`INSERT INTO user_features (user_id, feature, payment_reference, expires_at)
          VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MONTH))
        ON DUPLICATE KEY UPDATE payment_reference = VALUES(payment_reference), reminded_at = NULL, expired_notice_at = NULL,
          expires_at = IF(expires_at IS NULL, NULL, DATE_ADD(GREATEST(expires_at, NOW()), INTERVAL ? MONTH))`,
      [userId, i.feature, tx.reference, i.months, i.months])
    }
    sendReceipt(userId, items, tx, details)
  }
  return items.map((i) => i.feature)
}

app.post('/api/billing/webhook', express.raw({ type: 'application/json', limit: '100kb' }), async (req, res) => {
  const sig = req.get('x-paystack-signature') || ''
  const expected = crypto.createHmac('sha512', PAYSTACK_KEY).update(req.body).digest('hex')
  if (!PAYSTACK_KEY || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
    return res.status(401).end()
  const event = JSON.parse(req.body.toString('utf8'))
  if (event.event === 'charge.success') {
    // Re-fetch from Paystack rather than trusting the payload's amount.
    const tx = await paystack(`/transaction/verify/${encodeURIComponent(event.data.reference)}`)
    await applyPayment(tx)
  }
  res.sendStatus(200)
})

app.use('/api/profile', express.json({ limit: '900kb' })) // room for an uploaded profile picture
app.use(express.json({ limit: '20kb' }))

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } })
app.use('/api', limiter(60_000, 300, 'Too many requests, please slow down.'))
const authLimiter = limiter(15 * 60_000, 30, 'Too many attempts, try again in a few minutes.')
const clickLimiter = limiter(60_000, 30, 'Too many clicks.')
const contactLimiter = limiter(60 * 60_000, 5, 'You have sent a few messages already. Please try again later.')

// Usernames that would collide with site pages or static files.
const LINK_TYPES = ['instagram', 'tiktok', 'youtube', 'snapchat', 'pinterest', 'x', 'facebook', 'linkedin', 'github', 'whatsapp', 'music', 'store', 'website', 'other']
// A social badge must match the link's real domain, so a phishing page can't wear an "Instagram" badge.
const SOCIAL_HOSTS = {
  instagram: ['instagram.com'], tiktok: ['tiktok.com'], youtube: ['youtube.com', 'youtu.be'], snapchat: ['snapchat.com'],
  pinterest: ['pinterest.com', 'pin.it'], x: ['x.com', 'twitter.com'], facebook: ['facebook.com', 'fb.com', 'fb.me'],
  linkedin: ['linkedin.com'], github: ['github.com'], whatsapp: ['wa.me', 'whatsapp.com'],
}
function typeMatchesUrl(type, url) {
  const hosts = SOCIAL_HOSTS[type]
  if (!hosts) return true
  const host = new URL(url).hostname.replace(/^www\./, '')
  return hosts.some((h) => host === h || host.endsWith(`.${h}`))
}
// Paid (Pro) features are enforced here, not just hidden in the UI.
const PRO_LAYOUTS = Object.keys(LAYOUT_FEATURE)
const FREE_LINK_LIMIT = 3
const CATEGORIES = ['beauty', 'fashion', 'food', 'coaching', 'creative', 'health', 'tech', 'retail', 'events', 'education', 'finance', 'real_estate', 'home_services', 'nonprofit', 'travel', 'other']
const cleanCategory = (value = '') => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (CATEGORIES.includes(raw)) return raw
  if (raw.startsWith('other:')) {
    const custom = raw.slice(6).trim().replace(/\s+/g, ' ').slice(0, 60)
    return custom ? `other:${custom}` : ''
  }
  return ''
}
// WhatsApp numbers are stored as digits in international format (country code, no +), as wa.me expects.
const cleanPhone = (v) => String(v || '').replace(/[\s()-]/g, '').replace(/^\+/, '')
const phoneError = (v) => (v && !/^[1-9]\d{6,14}$/.test(v) ? 'Enter the WhatsApp number with its country code, e.g. +234 801 234 5678' : '')
const parseList = (v) => { try { return v ? JSON.parse(v) : [] } catch { return [] } }
const PLAN_SQL = "IF(plan = 'pro' AND (pro_until IS NULL OR pro_until > NOW()), 'pro', 'free') AS plan"
const isPro = async (userId) => (await pool.query(`SELECT ${PLAN_SQL} FROM users WHERE id = ?`, [userId]))[0][0]?.plan === 'pro'
// Every feature this user can use: all of them on a hand-set 'pro' plan, otherwise what they've bought.
async function unlockedFeatures(userId) {
  return Object.keys(await featureAccess(userId))
}
// { feature: 'YYYY-MM-DD' | null } for every active feature (null = no expiry).
async function featureAccess(userId) {
  if (await isPro(userId)) return Object.fromEntries(FEATURE_KEYS.map((k) => [k, null]))
  const [rows] = await pool.query(
    "SELECT feature, DATE_FORMAT(expires_at, '%Y-%m-%d') AS until FROM user_features WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())", [userId])
  return Object.fromEntries(rows.map((r) => [r.feature, r.until]))
}
const hasFeature = async (userId, key) => (await unlockedFeatures(userId)).includes(key)
const locked = (res, key) => res.status(402).json({ error: `${featureByKey[key].name} is a paid feature. Unlock it from your dashboard.`, upgrade: true, feature: key })
const RESERVED = new Set([
  'admin', 'api', 'login', 'logout', 'signup', 'register', 'contact', 'terms', 'privacy', 'about', 'help',
  'support', 'settings', 'dashboard', 'assets', 'static', 'public', 'index', 'home', 'www', 'mail', 'root',
  '404', 'status', 'blog', 'pricing', 'security', 'billing', 'owner', 'verify', 'forgot-password', 'reset-password',
])
// Sessions live in an httpOnly cookie, so page scripts can never read the token. SameSite=Lax blocks
// cross-site POST/PUT/DELETE, which covers CSRF for this JSON API. A Bearer header is still accepted
// for scripts and tests. token_version lets a password reset sign out every existing session.
const COOKIE = 'lh_session'
const cookieOpts = { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 3600 * 1000 }
const sign = (user) => jwt.sign({ id: user.id, tv: user.token_version || 0 }, SECRET, { expiresIn: '7d' })
const startSession = (res, user) => res.cookie(COOKIE, sign(user), cookieOpts)

function readToken(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))
  if (m) return decodeURIComponent(m[1])
  return (req.headers.authorization || '').replace(/^Bearer /, '')
}

async function sessionUserId(req) {
  const token = readToken(req)
  if (!token) return null
  try {
    const { id, tv = 0 } = jwt.verify(token, SECRET)
    const [[u]] = await pool.query('SELECT token_version FROM users WHERE id = ?', [id])
    return u && u.token_version === tv ? id : null
  } catch {
    return null
  }
}

// Founder dashboard access: only the configured owner email, and only once that email is verified
// (otherwise anyone could sign up with the address first and inherit owner access).
const { OWNER_EMAIL } = Email // hardcoded in emails.js so a wrong server setting can't lock the founder out
const ownsSite = (u) => !!u && String(u.email || '').trim().toLowerCase() === OWNER_EMAIL && !!u.email_verified
async function isOwner(userId) {
  const [[u]] = await pool.query('SELECT email, email_verified FROM users WHERE id = ?', [userId])
  return ownsSite(u)
}

async function auth(req, res, next) {
  const id = await sessionUserId(req)
  if (!id) return res.status(401).json({ error: 'Not authenticated' })
  req.userId = id
  next()
}

// ---- one-time email tokens (only a SHA-256 hash is stored) ----
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex')
async function issueToken(userId, kind, minutes) {
  const raw = crypto.randomBytes(32).toString('hex')
  await pool.query('UPDATE auth_tokens SET used_at = NOW() WHERE user_id = ? AND kind = ? AND used_at IS NULL', [userId, kind])
  await pool.query('INSERT INTO auth_tokens (user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [userId, kind, sha256(raw), minutes])
  return raw
}
async function consumeToken(raw, kind) {
  if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return null
  const [[t]] = await pool.query(
    'SELECT id, user_id FROM auth_tokens WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > NOW()', [sha256(raw), kind])
  if (!t) return null
  const [r] = await pool.query('UPDATE auth_tokens SET used_at = NOW() WHERE id = ? AND used_at IS NULL', [t.id])
  return r.affectedRows ? t.user_id : null
}
const appUrl = (req) => process.env.APP_URL || `${req.protocol}://${req.get('host')}`

async function sendVerification(req, user) {
  const raw = await issueToken(user.id, 'verify', 60 * 24)
  await send(user.email, Email.verifyEmail({ username: user.username, url: `${appUrl(req)}/verify?token=${raw}` }), { tag: 'verify' })
}

// ---- in-house analytics ----
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|curl|wget|headless|python|axios|node-fetch/i
const deviceOf = (ua) => (/ipad|tablet/i.test(ua) ? 'tablet' : /mobi|android|iphone/i.test(ua) ? 'mobile' : 'desktop')
function refHost(req, ref) {
  if (ref === 'qr') return 'qr' // visits that came from scanning the page's QR code
  try {
    const h = new URL(ref).hostname.replace(/^www\./, '').slice(0, 100)
    return h === req.hostname ? '' : h // our own pages count as direct
  } catch {
    return ''
  }
}
// Cookie-free visitor id: a hash of the IP and browser that changes every day, so repeat visits on the
// same day count once without storing anything on the visitor's device (no cookie, no consent prompt).
// The IP is never stored, and yesterday's ids can't be linked to today's.
function visitorId(req) {
  const day = new Date().toISOString().slice(0, 10)
  const ip = String(req.ip || '').replace(/^::ffff:/, '')
  return crypto.createHmac('sha256', SECRET).update(`${day}|${ip}|${req.get('user-agent') || ''}`).digest('hex').slice(0, 16)
}

// Offline IP → country lookup. Optional: if the package isn't installed yet (cPanel needs Run JS script → deps),
// the server still starts and falls back to the other country sources.
let ip3country = null
try { ip3country = (await import('ip3country')).default; ip3country.init() } catch { console.warn('ip3country not installed: country falls back to time zone') }

// Returns true when the event was recorded (false for bots and for a repeat view within 30 minutes).
async function track(req, res, { userId, kind, linkId = null, ref = '', tz = '' }) {
  const ua = req.get('user-agent') || ''
  if (BOT.test(ua)) return false
  const visitor = visitorId(req)
  if (kind === 'view' && visitor) {
    const [[recent]] = await pool.query(
      "SELECT 1 FROM events WHERE user_id = ? AND visitor = ? AND kind = 'view' AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1",
      [userId, visitor])
    if (recent) return false
  }
  // Country, best source first: a CDN geo header (Cloudflare), the visitor's IP looked up in an offline
  // database on this server (ip3country, IP2Location LITE), their browser time zone (Africa/Lagos → NG),
  // then the country of this visitor's last counted visit. The IP is only used for the lookup, never stored.
  const fromTz = /^[A-Za-z_]+\/[A-Za-z_/+-]+$/.test(tz) ? ct.getCountryForTimezone(tz)?.id || '' : ''
  let fromIp = ''
  try { fromIp = ip3country?.lookupStr(String(req.ip || '').replace(/^::ffff:/, '')) || '' } catch { /* private or bad IP */ }
  const valid = (c) => (/^[A-Z]{2}$/.test(String(c || '').toUpperCase()) && !['XX', 'T1', 'ZZ'].includes(String(c).toUpperCase()) ? String(c).toUpperCase() : '')
  let country = valid(req.get('cf-ipcountry')) || valid(fromIp) || valid(fromTz)
  if (!country && visitor) {
    const [[last]] = await pool.query("SELECT country FROM events WHERE visitor = ? AND country <> '' ORDER BY id DESC LIMIT 1", [visitor])
    country = last?.country || ''
  }
  await pool.query('INSERT INTO events (user_id, link_id, kind, referrer, device, country, visitor) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, linkId, kind, refHost(req, ref), deviceOf(ua), country, visitor])
  return true
}

function validUrl(value) {
  try {
    const u = new URL(value)
    return ['http:', 'https:', 'mailto:'].includes(u.protocol)
  } catch {
    return false
  }
}

// ---- Auth ----
app.get('/api/health', (req, res) => res.json({ ok: true }))

// A website's icon for "Website"/"Other" links, fetched by our server and cached, so visitors' browsers
// never contact a third party. 404 when the site has none (the app then shows a generic globe).
const favicons = new Map() // host → { buf, type, at } | { missing, at }
app.get('/api/favicon/:host', async (req, res) => {
  const host = String(req.params.host || '').toLowerCase()
  if (!/^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host) || /^(localhost|127\.|10\.|192\.168\.)/.test(host)) return res.status(400).end()
  let hit = favicons.get(host)
  if (!hit || Date.now() - hit.at > 86_400_000) {
    hit = { missing: true, at: Date.now() }
    try {
      const r = await fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`, { signal: AbortSignal.timeout(3000) })
      const type = r.headers.get('content-type') || ''
      const buf = Buffer.from(await r.arrayBuffer())
      if (r.ok && type.startsWith('image/') && buf.length > 0 && buf.length < 200_000) hit = { buf, type, at: Date.now() }
    } catch { /* offline or slow: treat as missing for now */ }
    if (favicons.size > 1000) favicons.delete(favicons.keys().next().value)
    favicons.set(host, hit)
  }
  if (hit.missing) return res.status(404).set('Cache-Control', 'public, max-age=3600').end()
  res.type(hit.type).set('Cache-Control', 'public, max-age=86400').send(hit.buf)
})

// Is a username free? Used by the "claim your link" box on the home page.
app.get('/api/username/:name', async (req, res) => {
  const name = String(req.params.name || '')
  if (!/^[a-z0-9_]{3,32}$/i.test(name)) return res.json({ available: false, reason: '3–32 letters, numbers or _' })
  if (RESERVED.has(name.toLowerCase())) return res.json({ available: false, reason: 'That one is reserved' })
  const [[taken]] = await pool.query('SELECT 1 AS x FROM users WHERE username = ? LIMIT 1', [name])
  res.json({ available: !taken, reason: taken ? 'Already taken' : '' })
})

app.post('/api/register', authLimiter, async (req, res) => {
  const { username, password, email = '', account_type = 'personal', category = '', whatsapp = '' } = req.body
  if (!/^[a-z0-9_]{3,32}$/i.test(username || ''))
    return res.status(400).json({ error: 'Username must be 3-32 letters, numbers or underscores' })
  if (RESERVED.has(username.toLowerCase()))
    return res.status(400).json({ error: 'That username is reserved, please choose another' })
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254)
    return res.status(400).json({ error: 'Please enter a valid email address' })
  if ((password || '').length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  const business = account_type === 'business'
  const phone = business ? cleanPhone(whatsapp) : ''
  const cleanCat = business ? cleanCategory(category) : ''
  if (phoneError(phone)) return res.status(400).json({ error: phoneError(phone) })
  if (business && !cleanCat) return res.status(400).json({ error: 'Choose your business industry' })
  try {
    const cleanEmail = email.trim().toLowerCase()
    // An unverified claim on this email doesn't block its real owner: release it to the new signup.
    await pool.query('UPDATE users SET email = NULL WHERE email = ? AND email_verified = 0', [cleanEmail])
    const hash = await bcrypt.hash(password, 10)
    const [r] = await pool.query(
      'INSERT INTO users (username, email, password_hash, display_name, account_type, category, whatsapp) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username.toLowerCase(), cleanEmail, hash, username, business ? 'business' : 'personal', cleanCat, phone]
    )
    const user = { id: r.insertId, username: username.toLowerCase(), email: cleanEmail, token_version: 0 }
    await pool.query('UPDATE users SET last_login_at = NOW(), login_count = 1 WHERE id = ?', [user.id])
    startSession(res, user)
    sendVerification(req, user).catch((e) => console.error('verification email:', e.message))
    send(OWNER_EMAIL, Email.ownerSignup({ username: user.username, email: cleanEmail, accountType: business ? 'business' : 'personal', category: cleanCat, url: `${appUrl(req)}/${user.username}` }), { tag: 'owner-signup' })
    res.json({ ok: true })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: /email/.test(e.message) ? 'That email is already registered' : 'Username taken' })
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body
  const id = String(username || '').trim().toLowerCase()
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1', [id, id])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password || '', user.password_hash)))
    return res.status(401).json({ error: 'Invalid username, email or password' })
  await pool.query('UPDATE users SET last_login_at = NOW(), login_count = login_count + 1 WHERE id = ?', [user.id])
  startSession(res, user)
  res.json({ ok: true })
})

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined })
  res.json({ ok: true })
})

// ---- email verification & password reset ----
app.post('/api/verify-email/send', auth, authLimiter, async (req, res) => {
  const [[user]] = await pool.query('SELECT id, username, email, email_verified FROM users WHERE id = ?', [req.userId])
  if (!user.email) return res.status(400).json({ error: 'Add an email address first' })
  if (user.email_verified) return res.json({ ok: true, already: true })
  await sendVerification(req, user)
  res.json({ ok: true })
})

// Add or change the account's email (e.g. an older account whose unconfirmed email was taken by a newer
// signup). It starts unconfirmed and a confirmation email goes out. Needed for payments and password resets.
app.post('/api/account/email', auth, authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'Please enter a valid email address' })
  const [[user]] = await pool.query('SELECT id, username, email, email_verified FROM users WHERE id = ?', [req.userId])
  if (user.email === email) {
    if (!user.email_verified) await sendVerification(req, user)
    return res.json({ ok: true, email, email_verified: !!user.email_verified })
  }
  const [[taken]] = await pool.query('SELECT id FROM users WHERE email = ? AND email_verified = 1 AND id <> ? LIMIT 1', [email, req.userId])
  if (taken) return res.status(409).json({ error: 'That email is already confirmed on another account. Log in to that one, or use a different email.' })
  await pool.query('UPDATE users SET email = NULL WHERE email = ? AND email_verified = 0 AND id <> ?', [email, req.userId])
  await pool.query('UPDATE users SET email = ?, email_verified = 0 WHERE id = ?', [email, req.userId])
  await sendVerification(req, { ...user, email })
  res.json({ ok: true, email, email_verified: false })
})

app.post('/api/verify-email', authLimiter, async (req, res) => {
  const userId = await consumeToken(req.body?.token, 'verify')
  if (!userId) return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one from your dashboard.' })
  const [upd] = await pool.query('UPDATE users SET email_verified = 1 WHERE id = ? AND email_verified = 0', [userId])
  if (upd.affectedRows) { // first confirmation only: send the welcome email
    const [[u]] = await pool.query('SELECT email, username, display_name, avatar_url FROM users WHERE id = ?', [userId])
    send(u.email, Email.welcome({ name: u.display_name || u.username, username: u.username, person: Email.personOf(u) }), { tag: 'welcome' })
  }
  res.json({ ok: true })
})

app.post('/api/password/forgot', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const [[user]] = await pool.query('SELECT id, username, email FROM users WHERE email = ?', [email])
  if (user) {
    const raw = await issueToken(user.id, 'reset', 60)
    await send(user.email, Email.resetPassword({ username: user.username, url: `${appUrl(req)}/reset-password?token=${raw}` }), { tag: 'reset' })
  }
  res.json({ ok: true }) // same answer either way, so this can't be used to find out who has an account
})

app.post('/api/password/reset', authLimiter, async (req, res) => {
  const { token, password = '' } = req.body || {}
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })
  const userId = await consumeToken(token, 'reset')
  if (!userId) return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' })
  // Resetting proves control of the inbox, so it also verifies the email; bumping token_version signs out old sessions.
  await pool.query('UPDATE users SET password_hash = ?, email_verified = 1, token_version = token_version + 1 WHERE id = ?',
    [await bcrypt.hash(password, 10), userId])
  const [[user]] = await pool.query('SELECT id, token_version, email, username, display_name, avatar_url FROM users WHERE id = ?', [userId])
  send(user.email, Email.passwordChanged({ username: user.username, person: Email.personOf(user) }), { tag: 'password-changed' })
  startSession(res, user)
  res.json({ ok: true })
})

// ---- Admin (authenticated) ----
app.get('/api/me', auth, async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT id, username, email, email_verified, display_name, bio, layout, avatar_url, cover_url, theme, tags, views, ${PLAN_SQL}, pro_until, note_body, note_sign, account_type, category, whatsapp, occupation, location, testimonials, bg_blur, onboarded_at, last_login_at FROM users WHERE id = ?`, [req.userId])
  const [links] = await pool.query(
    'SELECT id, title, url, type, clicks FROM links WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, id', [req.userId])
  res.json({ ...user, is_owner: ownsSite(user), testimonials: parseList(user.testimonials),
    features: await featureAccess(req.userId), links })
})

app.put('/api/profile', auth, async (req, res) => {
  const { display_name = '', bio = '', layout = 'classic', theme = 'light', avatar_url = '', cover_url = '', tags = '', account_type = 'personal', category = '', whatsapp = '', occupation = '', location = '', bg_blur = true } = req.body
  if (!['classic', 'grid', 'minimal', ...PRO_LAYOUTS].includes(layout)) return res.status(400).json({ error: 'Unknown layout' })
  if (LAYOUT_FEATURE[layout] && !(await hasFeature(req.userId, LAYOUT_FEATURE[layout]))) return locked(res, LAYOUT_FEATURE[layout])
  if (!['light', 'sage', 'midnight', 'blush', 'auto'].includes(theme)) return res.status(400).json({ error: 'Unknown theme' })
  // Images are either small uploaded data: URLs (resized in the browser) or plain https links.
  const imageError = (v, maxBytes, label) => {
    if (!v) return ''
    if (/^data:image\/(webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(v)) return v.length > maxBytes ? `That ${label} is too large` : ''
    return v.length <= 500 && /^https:\/\//i.test(v) && validUrl(v) ? '' : `The ${label} must be an uploaded picture or a valid https:// link`
  }
  const badImage = imageError(avatar_url, 300_000, 'profile picture') || imageError(cover_url, 600_000, 'cover image')
  if (badImage) return res.status(400).json({ error: badImage })
  const business = account_type === 'business'
  const phone = business ? cleanPhone(whatsapp) : ''
  const cleanCat = business ? cleanCategory(category) : ''
  if (phoneError(phone)) return res.status(400).json({ error: phoneError(phone) })
  if (business && category && !cleanCat) return res.status(400).json({ error: 'Unknown industry' })
  const cleanTags = String(tags).split(',').map((t) => t.trim().slice(0, 24)).filter(Boolean).slice(0, 4).join(',')
  await pool.query(`UPDATE users SET display_name = ?, bio = ?, layout = ?, theme = ?, avatar_url = ?, cover_url = ?, tags = ?,
      account_type = ?, category = ?, whatsapp = ?, occupation = ?, location = ?, bg_blur = ? WHERE id = ?`, [
    display_name.slice(0, 80), bio.slice(0, 255), layout, theme, avatar_url, cover_url || null, cleanTags,
    business ? 'business' : 'personal', cleanCat, phone, String(occupation).trim().slice(0, 80), String(location).trim().slice(0, 80), bg_blur === false || bg_blur === 0 ? 0 : 1, req.userId])
  res.json({ ok: true })
})

app.post('/api/onboarding/step', auth, async (req, res) => {
  const step = Math.max(0, Math.min(5, Number(req.body?.step) || 0))
  await pool.query('UPDATE users SET onboarding_step = GREATEST(onboarding_step, ?) WHERE id = ?', [step, req.userId])
  res.json({ ok: true })
})

app.post('/api/onboarding/complete', auth, async (req, res) => {
  await pool.query('UPDATE users SET onboarded_at = COALESCE(onboarded_at, NOW()) WHERE id = ?', [req.userId])
  res.json({ ok: true })
})

app.get('/api/billing/config', async (req, res) => {
  const p = await currentPricing()
  // Public key is safe to expose; read at runtime so cPanel's .env is enough (no rebuild needed).
  res.json({ enabled: !!PAYSTACK_KEY, publicKey: process.env.PAYSTACK_PUBLIC_KEY || process.env.VITE_PAYSTACK_PUBLIC_KEY || '', currency: 'NGN', durations: DURATIONS, discounts: p.discounts, features: p.catalog() })
})

app.post('/api/billing/checkout', auth, async (req, res) => {
  if (!PAYSTACK_KEY) return res.status(503).json({ error: 'Payments are not set up yet' })
  // One or several features in one payment: { items: [{ feature, months }] } (or the older { feature, months }).
  const raw = Array.isArray(req.body?.items) ? req.body.items : [{ feature: req.body?.feature, months: req.body?.months }]
  if (!raw.length || raw.length > 20) return res.status(400).json({ error: 'Choose at least one feature to unlock' })
  const pricing = await currentPricing()
  const items = []
  for (const r of raw) {
    const feature = featureByKey[r?.feature]
    const months = Number(r?.months)
    if (!feature) return res.status(400).json({ error: 'Choose a feature to unlock' })
    if (!DURATIONS.includes(months)) return res.status(400).json({ error: 'Choose 1, 3, 6 or 12 months' })
    if (items.some((i) => i.feature === feature.key)) continue
    const price = pricing.priceFor(feature.key, months)
    if (!price) return res.status(400).json({ error: `${feature.name} is coming soon` })
    items.push({ feature: feature.key, months, price })
  }
  const total = items.reduce((t, i) => t + i.price, 0)
  const [[user]] = await pool.query('SELECT id, email, username FROM users WHERE id = ?', [req.userId])
  if (!user.email) return res.status(400).json({ error: 'Add your email first: use the yellow box at the top of your dashboard' })
  // Our own reference, sent to Paystack so both sides use the same one: LQS-<time>-<random>.
  const reference = `LQS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  await pool.query(
    "INSERT INTO payments (user_id, reference, amount_kobo, currency, status, feature, months, items, customer_email) VALUES (?, ?, ?, 'NGN', 'initialized', ?, ?, ?, ?)",
    [user.id, reference, total * 100, items.length === 1 ? items[0].feature : 'bundle', items[0].months, JSON.stringify(items), user.email])
  const label = items.map((i) => `${featureByKey[i.feature].name} · ${i.months} mo`).join(', ')
  let tx
  try {
    tx = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({
      reference, email: user.email, amount: total * 100, currency: 'NGN',
      callback_url: `${appUrl(req)}/billing/callback`,
      metadata: { user_id: user.id, username: user.username, items,
        custom_fields: [{ display_name: items.length > 1 ? 'Features' : 'Feature', variable_name: 'features', value: label.slice(0, 250) }] },
    }) })
  } catch (e) {
    // Paystack refused (wrong/mismatched key, live mode not activated, …): say why instead of "Server error".
    console.error('Paystack initialize failed:', e.message)
    await pool.query("UPDATE payments SET status = 'failed', gateway_response = ? WHERE reference = ?", [String(e.message).slice(0, 120), reference])
    return res.status(502).json({ error: `Paystack: ${e.message}` })
  }
  // accessCode lets the browser open Paystack's inline popup; url is the full-page fallback.
  res.json({ url: tx.authorization_url, accessCode: tx.access_code, reference, total })
})

app.get('/api/billing/history', auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT reference, feature, months, items, amount_kobo / 100 AS amount, status, channel, card_type, last4, bank,
       DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m-%d %H:%i') AS date
     FROM payments WHERE user_id = ? AND status <> 'initialized' ORDER BY id DESC LIMIT 50`, [req.userId])
  res.json(rows.map((p) => ({ ...p, amount: Number(p.amount), name: paymentName(p) })))
})

app.post('/api/billing/verify', auth, async (req, res) => {
  const reference = String(req.body?.reference || '')
  if (!PAYSTACK_KEY || !/^[\w.-]{4,100}$/.test(reference)) return res.status(400).json({ error: 'Missing payment reference' })
  let tx
  try {
    tx = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`)
  } catch (e) {
    return res.status(400).json({ error: e.message || 'Could not find that payment' })
  }
  if (Number(tx.metadata?.user_id) !== req.userId) return res.status(403).json({ error: 'This payment belongs to another account' })
  const keys = await applyPayment(tx)
  if (!keys) return res.status(402).json({ error: `Payment not completed (${tx.status})` })
  const access = await featureAccess(req.userId)
  res.json({ ok: true, features: keys, name: keys.map((k) => featureByKey[k].name).join(', '), until: keys.length === 1 ? access[keys[0]] : null,
    items: keys.map((k) => ({ feature: k, name: featureByKey[k].name, until: access[k] })) })
})

app.put('/api/note', auth, async (req, res) => {
  if (!(await hasFeature(req.userId, 'founder_note'))) return locked(res, 'founder_note')
  const { body = '', sign = '' } = req.body || {}
  if (typeof body !== 'string' || body.length > 2000) return res.status(400).json({ error: 'Keep the note under 2000 characters' })
  await pool.query('UPDATE users SET note_body = ?, note_sign = ? WHERE id = ?', [body.trim() || null, String(sign).trim().slice(0, 60), req.userId])
  res.json({ ok: true })
})

app.put('/api/testimonials', auth, async (req, res) => {
  if (!(await hasFeature(req.userId, 'testimonials'))) return locked(res, 'testimonials')
  const list = Array.isArray(req.body?.items) ? req.body.items : []
  const clean = list.map((t) => String(t).trim().slice(0, 160)).filter(Boolean).slice(0, 6)
  await pool.query('UPDATE users SET testimonials = ? WHERE id = ?', [clean.length ? JSON.stringify(clean) : null, req.userId])
  res.json({ ok: true })
})

app.post('/api/links', auth, async (req, res) => {
  const { title, url, type = 'website' } = req.body
  if (!title?.trim() || !validUrl(url))
    return res.status(400).json({ error: 'Title and a valid http(s) URL are required' })
  if (!LINK_TYPES.includes(type)) return res.status(400).json({ error: 'Please choose a link type' })
  if (!typeMatchesUrl(type, url)) return res.status(400).json({ error: 'That link type does not match the URL' })
  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM links WHERE user_id = ? AND deleted_at IS NULL', [req.userId])
  if (count >= FREE_LINK_LIMIT && !(await hasFeature(req.userId, 'unlimited_links')))
    return res.status(402).json({ error: `Free pages hold ${FREE_LINK_LIMIT} links. Unlock unlimited links from your dashboard.`, upgrade: true, feature: 'unlimited_links' })
  const [[{ next }]] = await pool.query(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM links WHERE user_id = ? AND deleted_at IS NULL', [req.userId])
  const [r] = await pool.query(
    'INSERT INTO links (user_id, title, url, type, position) VALUES (?, ?, ?, ?, ?)',
    [req.userId, title.trim().slice(0, 100), url, type, next])
  res.json({ id: r.insertId, title, url, type, clicks: 0 })
})

app.put('/api/links/:id', auth, async (req, res) => {
  const { title, url, type = 'website' } = req.body
  if (!title?.trim() || !validUrl(url))
    return res.status(400).json({ error: 'Title and a valid http(s) URL are required' })
  if (!LINK_TYPES.includes(type)) return res.status(400).json({ error: 'Unknown link type' })
  if (!typeMatchesUrl(type, url)) return res.status(400).json({ error: 'That link type does not match the URL' })
  await pool.query('UPDATE links SET title = ?, url = ?, type = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL',
    [title.trim().slice(0, 100), url, type, req.params.id, req.userId])
  res.json({ ok: true })
})

app.delete('/api/links/:id', auth, async (req, res) => {
  await pool.query('UPDATE links SET deleted_at = NOW() WHERE id = ? AND user_id = ? AND deleted_at IS NULL', [req.params.id, req.userId])
  res.json({ ok: true })
})

// Persist a new order: body = { ids: [3, 1, 2] }
app.put('/api/links-order', auth, async (req, res) => {
  const ids = req.body.ids || []
  await Promise.all(ids.map((id, i) =>
    pool.query('UPDATE links SET position = ? WHERE id = ? AND user_id = ?', [i, id, req.userId])))
  res.json({ ok: true })
})

// ---- Public ----
app.get('/api/u/:username', async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT id, username, display_name, bio, layout, avatar_url, cover_url, theme, tags, ${PLAN_SQL}, note_body, note_sign, account_type, category, whatsapp, occupation, location, testimonials, bg_blur FROM users WHERE username = ?`,
    [req.params.username.toLowerCase()])
  if (!user) return res.status(404).json({ error: 'Profile not found' })
  // Anything not unlocked falls back to the free version instead of breaking the page.
  const unlocked = await unlockedFeatures(user.id)
  if (LAYOUT_FEATURE[user.layout] && !unlocked.includes(LAYOUT_FEATURE[user.layout])) user.layout = 'classic'
  if (!unlocked.includes('founder_note')) user.note_body = null
  if (!unlocked.includes('testimonials')) user.testimonials = null
  if (user.account_type !== 'business') user.whatsapp = ''
  delete user.plan
  // The owner looking at their own page isn't a visitor.
  if ((await sessionUserId(req)) !== user.id && (await track(req, res, { userId: user.id, kind: 'view', ref: req.query.src === 'qr' ? 'qr' : String(req.query.ref || ''), tz: String(req.query.tz || '') })))
    await pool.query('UPDATE users SET views = views + 1 WHERE id = ?', [user.id])
  const [links] = await pool.query(
    'SELECT id, title, url, type FROM links WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, id', [user.id])
  res.json({ ...user, testimonials: parseList(user.testimonials), links })
})

app.post('/api/click/:id', clickLimiter, async (req, res) => {
  const [[link]] = await pool.query('SELECT id, user_id FROM links WHERE id = ? AND deleted_at IS NULL', [req.params.id])
  if (link && (await sessionUserId(req)) !== link.user_id && (await track(req, res, { userId: link.user_id, kind: 'click', linkId: link.id, ref: String(req.body?.ref || ''), tz: String(req.body?.tz || '') })))
    await pool.query('UPDATE links SET clicks = clicks + 1 WHERE id = ?', [link.id])
  res.json({ ok: true })
})

// ---- Traffic report: the same analytics for one page (owner's dashboard) or the whole site (founder) ----
// scope: SQL on events e / users u, e.g. "e.user_id = ?" or the founder's filters.
async function trafficReport({ scope, args, days, siteWide = false }) {
  const since = 'e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
  const from = 'FROM events e JOIN users u ON u.id = e.user_id'
  const where = `WHERE ${scope} AND ${since}`
  const A = [...args, days - 1]
  const [[{ today }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today")
  const [rows] = await pool.query(`SELECT DATE_FORMAT(e.created_at, '%Y-%m-%d') AS d, e.kind, COUNT(*) AS n ${from} ${where} GROUP BY d, e.kind`, A)
  // Fill every day in the range so the chart has no gaps.
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    const at = (k) => Number(rows.find((r) => r.d === key && r.kind === k)?.n || 0)
    series.push({ date: key, views: at('view'), clicks: at('click') })
  }
  const views = series.reduce((t, x) => t + x.views, 0)
  const clicks = series.reduce((t, x) => t + x.clicks, 0)
  const group = async (col, kind, limit = 6) => (await pool.query(
    `SELECT ${col} AS name, COUNT(*) AS n ${from} ${where} AND e.kind = ? GROUP BY ${col} ORDER BY n DESC LIMIT ${limit}`, [...A, kind]))[0]
    .map((r) => ({ name: r.name, n: Number(r.n) }))
  const [[{ visitors }]] = await pool.query(`SELECT COUNT(DISTINCT e.visitor) AS visitors ${from} ${where} AND e.kind = 'view' AND e.visitor <> ''`, A)
  // Best time: views/clicks by weekday × hour, in UTC (the browser shifts it to local time).
  const [heat] = await pool.query(
    `SELECT WEEKDAY(CONVERT_TZ(e.created_at, @@session.time_zone, '+00:00')) AS d, HOUR(CONVERT_TZ(e.created_at, @@session.time_zone, '+00:00')) AS h,
       SUM(e.kind = 'view') AS views, SUM(e.kind = 'click') AS clicks ${from} ${where} GROUP BY d, h`, A)
  // New vs returning (visitors who accepted the cookie): returning = seen before this range, or on 2+ days in it.
  const [[nr]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(returning_) AS returning_ FROM (
       SELECT e.visitor, (COUNT(DISTINCT DATE(e.created_at)) > 1 OR EXISTS (
         SELECT 1 FROM events p WHERE p.visitor = e.visitor AND p.kind = 'view' ${siteWide ? '' : 'AND p.user_id = e.user_id'}
           AND p.created_at < DATE_SUB(CURDATE(), INTERVAL ? DAY))) AS returning_
       ${from} ${where} AND e.kind = 'view' AND e.visitor <> '' GROUP BY e.visitor${siteWide ? '' : ', e.user_id'}) v`, [days - 1, ...A])
  // This week vs the week before, for the summary line.
  const [[wk]] = await pool.query(
    `SELECT SUM(e.kind = 'view' AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS v_now,
            SUM(e.kind = 'view' AND e.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS v_prev,
            SUM(e.kind = 'click' AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS c_now,
            SUM(e.kind = 'click' AND e.created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS c_prev
     ${from} WHERE ${scope} AND e.created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)`, args)
  const [[best]] = await pool.query(
    `SELECT l.title, u.username, COUNT(*) AS n ${from} JOIN links l ON l.id = e.link_id
     WHERE ${scope} AND e.kind = 'click' AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) GROUP BY l.id, u.id ORDER BY n DESC LIMIT 1`, args)
  const change = (now, prev) => (Number(prev) ? Math.round(((Number(now) - Number(prev)) / Number(prev)) * 100) : null)
  const [[{ qr }]] = await pool.query(`SELECT COUNT(*) AS qr ${from} ${where} AND e.kind = 'view' AND e.referrer = 'qr'`, A)
  // Links by conversion: clicks on each link / page views.
  const [links] = await pool.query(
    `SELECT l.id, l.title, l.type, u.username, COUNT(*) AS n ${from} JOIN links l ON l.id = e.link_id
     ${where} AND e.kind = 'click' GROUP BY l.id, u.id ORDER BY n DESC LIMIT 10`, A)
  return {
    days, series, views, clicks, visitors: Number(visitors), qrScans: Number(qr),
    heat: heat.map((h) => ({ d: Number(h.d), h: Number(h.h), views: Number(h.views), clicks: Number(h.clicks) })),
    audience: { total: Number(nr.total || 0), returning: Number(nr.returning_ || 0) },
    week: {
      views: Number(wk.v_now || 0), clicks: Number(wk.c_now || 0),
      viewsChange: change(wk.v_now, wk.v_prev), clicksChange: change(wk.c_now, wk.c_prev),
      bestLink: best ? { title: siteWide ? `${best.title} (@${best.username})` : best.title, clicks: Number(best.n) } : null,
    },
    links: links.map((l) => ({ ...l, n: Number(l.n), rate: views ? Number(l.n) / views : 0 })),
    referrers: await group('e.referrer', 'view'),
    devices: await group('e.device', 'view', 3),
    countries: await group('e.country', 'view', 10),
  }
}

app.get('/api/analytics', auth, async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30
  if (days === 90 && !(await hasFeature(req.userId, 'analytics_90'))) return locked(res, 'analytics_90')
  const report = await trafficReport({ scope: 'e.user_id = ?', args: [req.userId], days })
  // Include links that got no clicks yet, so every link shows its conversion.
  const [all] = await pool.query('SELECT id, title, type FROM links WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, id', [req.userId])
  report.links = all.map((l) => {
    const hit = report.links.find((x) => x.id === l.id)
    return { ...l, n: hit?.n || 0, rate: hit?.rate || 0 }
  }).sort((x, y) => y.n - x.n).slice(0, 10)
  res.json(report)
})

// ---- CSV exports ----
const csvCell = (v) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v)
  return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"` : s
}
function sendCsv(res, name, rows, columns) {
  const head = columns.join(',')
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\n')
  res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', `attachment; filename="${name}"`).send(`﻿${head}\n${body}\n`)
}

// The owner's own page activity.
app.get('/api/analytics/export.csv', auth, async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30
  if (days === 90 && !(await hasFeature(req.userId, 'analytics_90'))) return locked(res, 'analytics_90')
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i') AS time, e.kind AS type, l.title AS link, l.url AS link_url,
       IF(e.referrer = '', 'direct', e.referrer) AS source, e.device, e.country
     FROM events e LEFT JOIN links l ON l.id = e.link_id
     WHERE e.user_id = ? AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY e.id DESC LIMIT 100000`, [req.userId, days - 1])
  sendCsv(res, `linqsafe-analytics-${days}d.csv`, rows, ['time', 'type', 'link', 'link_url', 'source', 'device', 'country'])
})

app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name = '', email = '', message = '', website = '' } = req.body || {}
  if (website) return res.json({ ok: true }) // honeypot filled: pretend success, store nothing
  if (!name.trim() || name.length > 100) return res.status(400).json({ error: 'Please enter your name' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    return res.status(400).json({ error: 'Please enter a valid email address' })
  if (message.trim().length < 10 || message.length > 5000)
    return res.status(400).json({ error: 'Message must be between 10 and 5000 characters' })
  await pool.query('INSERT INTO contact_messages (name, email, message) VALUES (?, ?, ?)', [
    name.trim(), email.trim(), message.trim()])
  const msg = { name: name.trim(), email: email.trim(), message: message.trim() }
  // To support (reply goes straight to the sender) and a short "we got it" to the sender.
  send(process.env.SUPPORT_EMAIL || OWNER_EMAIL, Email.contactNotify(msg), { tag: 'contact', replyTo: msg.email })
  send(msg.email, Email.contactReceived(msg), { tag: 'contact-auto-reply' })
  res.json({ ok: true })
})

// ---- Founder / owner analytics (whole site) ----
// With ADMIN_HOST set (e.g. admin.linqsafe.com), the founder API only answers on that subdomain.
const ADMIN_HOSTS = (process.env.ADMIN_HOST || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
app.get('/api/owner/stats', auth, async (req, res) => {
  if (ADMIN_HOSTS.length && !ADMIN_HOSTS.includes(req.hostname)) return res.status(404).json({ error: 'Not found' })
  if (!(await isOwner(req.userId))) return res.status(403).json({ error: 'Owner only' })
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30
  const q = async (sql, args = []) => (await pool.query(sql, args))[0]
  const [[totals]] = await pool.query(`SELECT COUNT(*) AS users,
      (SELECT COUNT(DISTINCT user_id) FROM user_features WHERE expires_at IS NULL OR expires_at > NOW()) AS pro, SUM(account_type = 'business') AS business, SUM(email_verified) AS verified,
      SUM(created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)) AS new_users FROM users`, [days - 1])
  const [[{ links }]] = await pool.query('SELECT COUNT(*) AS links FROM links WHERE deleted_at IS NULL')
  const [[{ revenue }]] = await pool.query(
    "SELECT COALESCE(SUM(amount_kobo), 0) / 100 AS revenue FROM payments WHERE status = 'success' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", [days - 1])
  const [[ev]] = await pool.query(`SELECT SUM(kind = 'view') AS views, SUM(kind = 'click') AS clicks, COUNT(DISTINCT visitor) AS visitors
      FROM events WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [days - 1])
  const [[{ today }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today")
  const signupRows = await q(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, COUNT(*) AS n FROM users
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY d`, [days - 1])
  const eventRows = await q(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, kind, COUNT(*) AS n FROM events
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY d, kind`, [days - 1])
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    series.push({
      date: key,
      signups: Number(signupRows.find((r) => r.d === key)?.n || 0),
      views: Number(eventRows.find((r) => r.d === key && r.kind === 'view')?.n || 0),
      clicks: Number(eventRows.find((r) => r.d === key && r.kind === 'click')?.n || 0),
    })
  }
  const num = (rows) => rows.map((r) => ({ name: r.name, n: Number(r.n) }))
  // Activation funnel for people who signed up in this range.
  const [[fn]] = await pool.query(
    `SELECT COUNT(*) AS signed_up,
       SUM(onboarded_at IS NOT NULL) AS onboarded,
       SUM(bio <> '' OR avatar_url IS NOT NULL AND avatar_url <> '') AS profile,
       SUM(EXISTS (SELECT 1 FROM links l WHERE l.user_id = u.id AND l.deleted_at IS NULL)) AS first_link,
       SUM(EXISTS (SELECT 1 FROM events e WHERE e.user_id = u.id AND e.kind = 'view')) AS first_visit,
       SUM(EXISTS (SELECT 1 FROM payments p WHERE p.user_id = u.id AND p.status = 'success')) AS paid
     FROM users u WHERE u.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [days - 1])
  const [steps] = await pool.query(
    `SELECT onboarding_step AS step, COUNT(*) AS n FROM users WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY onboarding_step`, [days - 1])

  // Revenue. Time-based purchases are spread over their months: the run-rate counts amount ÷ months
  // for every purchase still running today (the closest thing to MRR without subscriptions).
  const [[rev]] = await pool.query(
    `SELECT COALESCE(SUM(amount_kobo / 100 / GREATEST(months, 1)), 0) AS run_rate FROM payments
     WHERE status = 'success' AND DATE_ADD(paid_at, INTERVAL GREATEST(months, 1) MONTH) > NOW()`)
  const [[life]] = await pool.query(
    "SELECT COALESCE(SUM(amount_kobo), 0) / 100 AS total, COUNT(DISTINCT user_id) AS payers FROM payments WHERE status = 'success'")
  // Split multi-feature payments across their features by each item's price (falls back to an even split).
  const paidRows = await q(`SELECT feature, items, amount_kobo FROM payments
     WHERE status = 'success' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`, [days - 1])
  const featureTotals = {}
  for (const r of paidRows) {
    let list = []
    try { list = r.items ? JSON.parse(r.items) : [] } catch { /* ignore */ }
    if (!list.length) list = [{ feature: r.feature, price: 0 }]
    const amount = Number(r.amount_kobo) / 100
    const priced = list.reduce((t, i) => t + (Number(i.price) || 0), 0)
    for (const i of list) featureTotals[i.feature] = (featureTotals[i.feature] || 0) + (priced ? amount * (Number(i.price) || 0) / priced : amount / list.length)
  }
  const byFeature = Object.entries(featureTotals).map(([name, n]) => ({ name, n: Math.round(n) })).sort((a, b) => b.n - a.n)
  const byMonth = await q(
    `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS month, SUM(amount_kobo) / 100 AS amount FROM payments
     WHERE status = 'success' AND paid_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH) GROUP BY month ORDER BY month`)
  const [[exp]] = await pool.query(
    `SELECT SUM(expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)) AS soon,
            SUM(expires_at BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND NOW()) AS expired
     FROM user_features`)
  const [[{ renewed }]] = await pool.query(
    `SELECT COUNT(*) AS renewed FROM (SELECT user_id, feature FROM payments WHERE status = 'success'
       GROUP BY user_id, feature HAVING COUNT(*) > 1) r`)
  const expiring = await q(
    `SELECT u.username, f.feature, DATE_FORMAT(f.expires_at, '%Y-%m-%d') AS until FROM user_features f JOIN users u ON u.id = f.user_id
     WHERE f.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY) ORDER BY f.expires_at LIMIT 10`)
  const featureUse = num(await q(
    'SELECT feature AS name, COUNT(*) AS n FROM user_features WHERE expires_at IS NULL OR expires_at > NOW() GROUP BY feature ORDER BY n DESC'))

  res.json({
    days,
    funnel: Object.fromEntries(Object.entries(fn).map(([k, v]) => [k, Number(v || 0)])),
    onboardingSteps: steps.map((r) => ({ step: Number(r.step), n: Number(r.n) })),
    money: {
      runRate: Number(rev.run_rate), arr: Number(rev.run_rate) * 12, lifetime: Number(life.total),
      payers: Number(life.payers), arppu: Number(life.payers) ? Number(life.total) / Number(life.payers) : 0,
      byFeature: byFeature.map((r) => ({ name: featureByKey[r.name]?.name || r.name, n: Number(r.n) })),
      byMonth: byMonth.map((r) => ({ month: r.month, amount: Number(r.amount) })),
    },
    expiry: { soon: Number(exp.soon || 0), expired: Number(exp.expired || 0), renewed: Number(renewed), list: expiring.map((e) => ({ ...e, name: featureByKey[e.feature]?.name || e.feature })) },
    featureUse: featureUse.map((f) => ({ ...f, name: featureByKey[f.name]?.name || f.name })),
    totals: { users: Number(totals.users), pro: Number(totals.pro || 0), business: Number(totals.business || 0), verified: Number(totals.verified || 0),
      newUsers: Number(totals.new_users || 0), links: Number(links), revenue: Number(revenue), views: Number(ev.views || 0), clicks: Number(ev.clicks || 0), visitors: Number(ev.visitors || 0) },
    series,
    categories: num(await q("SELECT category AS name, COUNT(*) AS n FROM users WHERE account_type = 'business' GROUP BY category ORDER BY n DESC")),
    templates: num(await q('SELECT layout AS name, COUNT(*) AS n FROM users GROUP BY layout ORDER BY n DESC')),
    countries: num(await q('SELECT country AS name, COUNT(*) AS n FROM events WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND kind = \'view\' GROUP BY country ORDER BY n DESC LIMIT 10', [days - 1])),
    topPages: num(await q(`SELECT u.username AS name, COUNT(*) AS n FROM events e JOIN users u ON u.id = e.user_id
      WHERE e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) AND e.kind = 'view' GROUP BY u.id ORDER BY n DESC LIMIT 8`, [days - 1])),
    recent: await q(`SELECT username, account_type, category, plan, email_verified,
      (SELECT COUNT(*) FROM user_features uf WHERE uf.user_id = users.id AND (uf.expires_at IS NULL OR uf.expires_at > NOW())) AS paid_features, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i') AS joined,
      DATE_FORMAT(last_login_at, '%Y-%m-%d %H:%i') AS last_login, login_count, onboarded_at IS NOT NULL AS onboarded
      FROM users ORDER BY id DESC LIMIT 12`),
    messages: await q("SELECT name, email, LEFT(message, 140) AS message, DATE_FORMAT(created_at, '%Y-%m-%d') AS sent FROM contact_messages ORDER BY id DESC LIMIT 8"),
    payments: (await q(`SELECT p.reference, p.paystack_id, u.username, p.customer_email, p.feature, p.items, p.months, p.amount_kobo / 100 AS amount,
        p.status, p.channel, p.card_type, p.last4, p.bank, p.gateway_response, DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m-%d %H:%i') AS date
      FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 30`)).map((p) => ({ ...p, amount: Number(p.amount), name: paymentName(p) })),
    methods: num(await q(`SELECT channel AS name, COUNT(*) AS n FROM payments WHERE status = 'success'
      AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY channel ORDER BY n DESC`, [days - 1])),
  })
})

// Founder pricing editor. Same access rules as the founder stats.
async function ownerOnly(req, res, next) {
  if (ADMIN_HOSTS.length && !ADMIN_HOSTS.includes(req.hostname)) return res.status(404).json({ error: 'Not found' })
  if (!(await isOwner(req.userId))) return res.status(403).json({ error: 'Owner only' })
  next()
}

// ---- Founder traffic: the users' analytics for the whole site, filterable ----
const OWNER_DAYS = [7, 30, 90, 180, 365]
const ownerDays = (q) => (OWNER_DAYS.includes(Number(q.days)) ? Number(q.days) : 30)
// Filters (all optional): account, category, template, paid, country, device, source, user.
function trafficFilter(q) {
  const where = ['1 = 1']
  const args = []
  const add = (sql, ...v) => { where.push(sql); args.push(...v) }
  if (['personal', 'business'].includes(q.account)) add('u.account_type = ?', q.account)
  if (q.category) add('u.category = ?', String(q.category).slice(0, 80))
  if (q.template) add('u.layout = ?', String(q.template).slice(0, 16))
  const paidSql = 'EXISTS (SELECT 1 FROM user_features f WHERE f.user_id = u.id AND (f.expires_at IS NULL OR f.expires_at > NOW()))'
  if (q.paid === 'paid') where.push(paidSql)
  if (q.paid === 'free') where.push(`NOT ${paidSql}`)
  if (q.user) add('u.username = ?', String(q.user).toLowerCase().replace(/^@/, '').slice(0, 40))
  // Visit filters apply to the events themselves.
  if (/^[A-Za-z]{2}$/.test(q.country || '')) add('e.country = ?', q.country.toUpperCase())
  if (q.country === 'unknown') where.push("e.country = ''")
  if (['mobile', 'desktop', 'tablet'].includes(q.device)) add('e.device = ?', q.device)
  if (q.source === 'direct') where.push("e.referrer = ''")
  else if (q.source) add('e.referrer = ?', String(q.source).slice(0, 120))
  return { scope: where.join(' AND '), args }
}

app.get('/api/owner/traffic', auth, ownerOnly, async (req, res) => {
  const days = ownerDays(req.query)
  const { scope, args } = trafficFilter(req.query)
  const report = await trafficReport({ scope, args, days, siteWide: true })
  const since = 'e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
  const from = 'FROM events e JOIN users u ON u.id = e.user_id'
  const A = [...args, days - 1]
  const num = (rows) => rows.map((r) => ({ ...r, n: Number(r.n) }))
  // More than a single page shows: who gets the traffic, and how it converts.
  const [pages] = await pool.query(
    `SELECT u.username, u.account_type, SUM(e.kind = 'view') AS views, SUM(e.kind = 'click') AS clicks, COUNT(DISTINCT IF(e.visitor = '', NULL, e.visitor)) AS visitors
     ${from} WHERE ${scope} AND ${since} GROUP BY u.id ORDER BY views DESC LIMIT 15`, A)
  const [types] = await pool.query(
    `SELECT l.type AS name, COUNT(*) AS n ${from} JOIN links l ON l.id = e.link_id WHERE ${scope} AND ${since} AND e.kind = 'click' GROUP BY l.type ORDER BY n DESC LIMIT 8`, A)
  const [byAccount] = await pool.query(`SELECT u.account_type AS name, COUNT(*) AS n ${from} WHERE ${scope} AND ${since} AND e.kind = 'view' GROUP BY u.account_type`, A)
  const [byTemplate] = await pool.query(`SELECT u.layout AS name, COUNT(*) AS n ${from} WHERE ${scope} AND ${since} AND e.kind = 'view' GROUP BY u.layout ORDER BY n DESC`, A)
  const [[{ active }]] = await pool.query(`SELECT COUNT(DISTINCT e.user_id) AS active ${from} WHERE ${scope} AND ${since} AND e.kind = 'view'`, A)
  // Options for the filter dropdowns.
  const [categories] = await pool.query("SELECT DISTINCT category AS v FROM users WHERE category <> '' ORDER BY v")
  const [countries] = await pool.query("SELECT DISTINCT country AS v FROM events WHERE country <> '' ORDER BY v")
  const [sources] = await pool.query("SELECT referrer AS v, COUNT(*) AS n FROM events WHERE referrer <> '' GROUP BY referrer ORDER BY n DESC LIMIT 30")
  res.json({
    ...report,
    activePages: Number(active),
    pages: pages.map((p) => ({ ...p, views: Number(p.views), clicks: Number(p.clicks), visitors: Number(p.visitors) })),
    linkTypes: num(types), byAccount: num(byAccount), byTemplate: num(byTemplate),
    options: {
      days: OWNER_DAYS,
      categories: categories.map((r) => r.v),
      templates: ['classic', 'cover', 'editorial', 'search', 'idcard', 'backdrop'],
      countries: countries.map((r) => r.v),
      sources: sources.map((r) => r.v),
    },
  })
})

// Founder CSV exports. Same filters as the traffic view.
app.get('/api/owner/export/:what.csv', auth, ownerOnly, async (req, res) => {
  const days = ownerDays(req.query)
  const { scope, args } = trafficFilter(req.query)
  const stamp = new Date().toISOString().slice(0, 10)
  if (req.params.what === 'events') {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(e.created_at, '%Y-%m-%d %H:%i') AS time, u.username, u.account_type, e.kind AS type, l.title AS link, l.url AS link_url,
         IF(e.referrer = '', 'direct', e.referrer) AS source, e.device, e.country
       FROM events e JOIN users u ON u.id = e.user_id LEFT JOIN links l ON l.id = e.link_id
       WHERE ${scope} AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY e.id DESC LIMIT 200000`, [...args, days - 1])
    return sendCsv(res, `linqsafe-traffic-${days}d-${stamp}.csv`, rows, ['time', 'username', 'account_type', 'type', 'link', 'link_url', 'source', 'device', 'country'])
  }
  if (req.params.what === 'pages') {
    const [rows] = await pool.query(
      `SELECT u.username, u.account_type, u.category, u.layout AS template, SUM(e.kind = 'view') AS views, SUM(e.kind = 'click') AS clicks,
         COUNT(DISTINCT IF(e.visitor = '', NULL, e.visitor)) AS visitors
       FROM events e JOIN users u ON u.id = e.user_id WHERE ${scope} AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
       GROUP BY u.id ORDER BY views DESC`, [...args, days - 1])
    return sendCsv(res, `linqsafe-pages-${days}d-${stamp}.csv`, rows, ['username', 'account_type', 'category', 'template', 'views', 'clicks', 'visitors'])
  }
  if (req.params.what === 'users') {
    // User filters only (visit filters don't apply to a list of accounts).
    const { scope: us, args: ua } = trafficFilter({ ...req.query, country: '', device: '', source: '' })
    const [rows] = await pool.query(
      `SELECT u.username, u.email, u.display_name AS name, u.account_type, u.category, u.layout AS template, u.email_verified,
         u.onboarded_at IS NOT NULL AS onboarded, (SELECT COUNT(*) FROM links l WHERE l.user_id = u.id AND l.deleted_at IS NULL) AS links,
         (SELECT GROUP_CONCAT(f.feature) FROM user_features f WHERE f.user_id = u.id AND (f.expires_at IS NULL OR f.expires_at > NOW())) AS paid_features,
         (SELECT COALESCE(SUM(p.amount_kobo), 0) / 100 FROM payments p WHERE p.user_id = u.id AND p.status = 'success') AS total_paid,
         DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i') AS joined, DATE_FORMAT(u.last_login_at, '%Y-%m-%d %H:%i') AS last_login, u.login_count
       FROM users u WHERE ${us} ORDER BY u.id DESC`, ua)
    return sendCsv(res, `linqsafe-users-${stamp}.csv`, rows,
      ['username', 'email', 'name', 'account_type', 'category', 'template', 'email_verified', 'onboarded', 'links', 'paid_features', 'total_paid', 'joined', 'last_login', 'login_count'])
  }
  if (req.params.what === 'payments') {
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m-%d %H:%i') AS date, p.reference, u.username, p.customer_email AS email,
         p.feature, p.items, p.months, p.amount_kobo / 100 AS amount, p.status, p.channel, p.card_type, p.bank
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) ORDER BY p.id DESC`, [days - 1])
    const out = rows.map((p) => ({ ...p, item: paymentName(p) }))
    return sendCsv(res, `linqsafe-payments-${days}d-${stamp}.csv`, out,
      ['date', 'reference', 'username', 'email', 'item', 'months', 'amount', 'status', 'channel', 'card_type', 'bank'])
  }
  res.status(404).json({ error: 'Unknown export' })
})

app.get('/api/owner/pricing', auth, ownerOnly, async (req, res) => {
  const p = await currentPricing()
  res.json({ durations: DURATIONS, discounts: p.discounts, features: p.catalog() })
})
app.put('/api/owner/pricing', auth, ownerOnly, async (req, res) => {
  const { prices = {}, discounts = {} } = req.body || {}
  const rows = []
  for (const f of FEATURES) {
    if (!(f.key in prices)) continue
    const v = Number(prices[f.key])
    if (!Number.isInteger(v) || v < 0 || v > 10_000_000) return res.status(400).json({ error: `Invalid price for ${f.name}` })
    rows.push([`PRICE_${f.key.toUpperCase()}`, String(v)])
  }
  for (const m of [3, 6, 12]) {
    if (!(m in discounts)) continue
    const v = Number(discounts[m])
    if (!Number.isFinite(v) || v < 0 || v > 90) return res.status(400).json({ error: `Discount for ${m} months must be 0–90%` })
    rows.push([`DISCOUNT_${m}M`, String(v)])
  }
  for (const [name, value] of rows)
    await pool.query('INSERT INTO app_settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [name, value])
  const p = await currentPricing()
  res.json({ ok: true, discounts: p.discounts, features: p.catalog() })
})

// ---- SEO: robots.txt, sitemap.xml, profile pictures for link previews ----
const seo = createSeo({ pool, dist: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist') })
app.use((req, res, next) => {
  if (!indexable(req.hostname)) res.set('X-Robots-Tag', 'noindex, nofollow') // dev.* and admin.* stay out of search
  next()
})
app.get('/robots.txt', seo.robots)
app.get('/sitemap.xml', seo.sitemap)
app.get('/api/u/:username/avatar', seo.avatar)
app.get('/og/:username.png', createOg({ pool }).image)

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// ---- Serve the built frontend (production) ----
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(dist, { maxAge: '1h', index: false, setHeaders: (res, file) => {
  if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
} }))
// SPA fallback: any non-API GET returns the app (so /contact and /:username work on refresh), with that
// page's title, description, share image and structured data filled in (server/seo.js).
app.get('*', seo.page)

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

export default app
