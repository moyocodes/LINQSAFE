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
import { actionEmail, sendMail } from './mailer.js'
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
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
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
// Records a verified Paystack transaction once (reference is unique) and unlocks the feature it paid for
// for the months bought, stacked on any time left. Returns the feature key, or null if it doesn't check out.
async function applyPayment(tx) {
  const userId = Number(tx.metadata?.user_id)
  const feature = featureByKey[tx.metadata?.feature]
  const months = Number(tx.metadata?.months)
  if (!userId || !feature || !DURATIONS.includes(months)) return null
  // Accept what the price was at checkout (stored in metadata) as long as it's what was actually paid.
  const price = Number(tx.metadata?.price) || (await currentPricing()).priceFor(feature.key, months)
  // How they paid, for the founder's payments view and the customer's receipts.
  const a = tx.authorization || {}
  const details = {
    paystack_id: tx.id || null, channel: String(tx.channel || a.channel || '').slice(0, 20),
    card_type: String(a.card_type || '').trim().slice(0, 30), last4: String(a.last4 || '').slice(0, 4),
    bank: String(a.bank || '').slice(0, 80), customer_email: String(tx.customer?.email || '').slice(0, 254),
    gateway_response: String(tx.gateway_response || '').slice(0, 120),
  }
  const paid = tx.status === 'success' && tx.currency === 'NGN' && price && tx.amount >= price * 100
  const status = paid ? 'success' : tx.status === 'success' ? 'underpaid' : String(tx.status || 'unknown').slice(0, 20)
  // Record/refresh the payment row. `first` is true only for the one request that marks it successful,
  // so the callback and the webhook can't both grant the time.
  const [upd] = await pool.query(
    `UPDATE payments SET status = ?, amount_kobo = ?, paystack_id = ?, channel = ?, card_type = ?, last4 = ?, bank = ?,
       customer_email = ?, gateway_response = ?, paid_at = IF(? = 'success', NOW(), paid_at)
     WHERE reference = ? AND status <> 'success'`,
    [status, tx.amount, details.paystack_id, details.channel, details.card_type, details.last4, details.bank,
      details.customer_email, details.gateway_response, status, tx.reference])
  let first = upd.affectedRows > 0 && status === 'success'
  if (!upd.affectedRows) {
    const [ins] = await pool.query(
      `INSERT IGNORE INTO payments (user_id, reference, amount_kobo, currency, status, feature, months, paystack_id, channel, card_type,
         last4, bank, customer_email, gateway_response, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, IF(? = 'success', NOW(), NULL))`,
      [userId, tx.reference, tx.amount, tx.currency, status, feature.key, months, details.paystack_id, details.channel, details.card_type,
        details.last4, details.bank, details.customer_email, details.gateway_response, status])
    first = ins.affectedRows > 0 && status === 'success'
  }
  if (!paid) return null
  if (first) { // first time this payment succeeded: grant/extend once
    await pool.query(`INSERT INTO user_features (user_id, feature, payment_reference, expires_at)
        VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MONTH))
      ON DUPLICATE KEY UPDATE payment_reference = VALUES(payment_reference),
        expires_at = IF(expires_at IS NULL, NULL, DATE_ADD(GREATEST(expires_at, NOW()), INTERVAL ? MONTH))`,
    [userId, feature.key, tx.reference, months, months])
  }
  return feature.key
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
const OWNER_EMAIL = (process.env.OWNER_EMAIL || 'moyosorejames@gmail.com').toLowerCase()
async function isOwner(userId) {
  const [[u]] = await pool.query('SELECT email, email_verified FROM users WHERE id = ?', [userId])
  return !!u && u.email === OWNER_EMAIL && !!u.email_verified
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
  await sendMail({ to: user.email, subject: 'Confirm your email', ...actionEmail({
    heading: `Confirm your email, ${user.username}`,
    body: 'Tap the button to confirm this is your email address. The link works for 24 hours.',
    button: 'Confirm email', url: `${appUrl(req)}/verify?token=${raw}`,
  }) })
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
// Anonymous visitor cookie: a random id, so repeat visits by the same browser count once.
const VISITOR = 'lh_vid'
// Only set once the visitor has accepted the cookie notice (consent=1); otherwise views are still
// counted, just without a visitor id (so they can't be de-duplicated or counted as unique).
function visitorId(req, res, consent) {
  if (!consent) return ''
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${VISITOR}=([a-f0-9]{16})`))
  if (m) return m[1]
  const id = crypto.randomBytes(8).toString('hex')
  res.cookie(VISITOR, id, { httpOnly: true, secure: isProd, sameSite: 'lax', path: '/', maxAge: 365 * 24 * 3600 * 1000 })
  return id
}

// Returns true when the event was recorded (false for bots and for a repeat view within 30 minutes).
async function track(req, res, { userId, kind, linkId = null, ref = '', consent = false, tz = '' }) {
  const ua = req.get('user-agent') || ''
  if (BOT.test(ua)) return false
  const visitor = visitorId(req, res, consent)
  if (kind === 'view' && visitor) {
    const [[recent]] = await pool.query(
      "SELECT 1 FROM events WHERE user_id = ? AND visitor = ? AND kind = 'view' AND created_at > DATE_SUB(NOW(), INTERVAL 30 MINUTE) LIMIT 1",
      [userId, visitor])
    if (recent) return false
  }
  // Country: the host's geo header (Vercel / Cloudflare) when present, otherwise the visitor's browser
  // time zone (e.g. Africa/Lagos → NG). No IP address or user agent is stored.
  const fromTz = /^[A-Za-z_]+\/[A-Za-z_/+-]+$/.test(tz) ? ct.getCountryForTimezone(tz)?.id || '' : ''
  const country = (req.get('x-vercel-ip-country') || req.get('cf-ipcountry') || fromTz).slice(0, 2).toUpperCase()
  await pool.query('INSERT INTO events (user_id, link_id, kind, referrer, device, country, visitor) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [userId, linkId, kind, refHost(req, ref), deviceOf(ua), /^[A-Z]{2}$/.test(country) ? country : '', visitor])
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

app.post('/api/verify-email', authLimiter, async (req, res) => {
  const userId = await consumeToken(req.body?.token, 'verify')
  if (!userId) return res.status(400).json({ error: 'This link is invalid or has expired. Request a new one from your dashboard.' })
  await pool.query('UPDATE users SET email_verified = 1 WHERE id = ?', [userId])
  res.json({ ok: true })
})

app.post('/api/password/forgot', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const [[user]] = await pool.query('SELECT id, username, email FROM users WHERE email = ?', [email])
  if (user) {
    const raw = await issueToken(user.id, 'reset', 60)
    await sendMail({ to: user.email, subject: 'Reset your password', ...actionEmail({
      heading: 'Reset your password',
      body: `Someone asked to reset the password for ${user.username}. The link works for 1 hour.`,
      button: 'Choose a new password', url: `${appUrl(req)}/reset-password?token=${raw}`,
    }) })
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
  const [[user]] = await pool.query('SELECT id, token_version FROM users WHERE id = ?', [userId])
  startSession(res, user)
  res.json({ ok: true })
})

// ---- Admin (authenticated) ----
app.get('/api/me', auth, async (req, res) => {
  const [[user]] = await pool.query(
    `SELECT id, username, email, email_verified, display_name, bio, layout, avatar_url, cover_url, theme, tags, views, ${PLAN_SQL}, pro_until, note_body, note_sign, account_type, category, whatsapp, occupation, location, testimonials, onboarded_at, last_login_at FROM users WHERE id = ?`, [req.userId])
  const [links] = await pool.query(
    'SELECT id, title, url, type, clicks FROM links WHERE user_id = ? ORDER BY position, id', [req.userId])
  res.json({ ...user, is_owner: user.email === OWNER_EMAIL && !!user.email_verified, testimonials: parseList(user.testimonials),
    features: await featureAccess(req.userId), links })
})

app.put('/api/profile', auth, async (req, res) => {
  const { display_name = '', bio = '', layout = 'classic', theme = 'light', avatar_url = '', cover_url = '', tags = '', account_type = 'personal', category = '', whatsapp = '', occupation = '', location = '' } = req.body
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
      account_type = ?, category = ?, whatsapp = ?, occupation = ?, location = ? WHERE id = ?`, [
    display_name.slice(0, 80), bio.slice(0, 255), layout, theme, avatar_url, cover_url || null, cleanTags,
    business ? 'business' : 'personal', cleanCat, phone, String(occupation).trim().slice(0, 80), String(location).trim().slice(0, 80), req.userId])
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
  const feature = featureByKey[req.body?.feature]
  const months = Number(req.body?.months)
  if (!feature) return res.status(400).json({ error: 'Choose a feature to unlock' })
  if (!DURATIONS.includes(months)) return res.status(400).json({ error: 'Choose 1, 3, 6 or 12 months' })
  const price = (await currentPricing()).priceFor(feature.key, months)
  if (!price) return res.status(400).json({ error: `${feature.name} is coming soon` })
  const [[user]] = await pool.query('SELECT id, email, username FROM users WHERE id = ?', [req.userId])
  if (!user.email) return res.status(400).json({ error: 'Add an email address to your account first' })
  // Our own reference, sent to Paystack so both sides use the same one: LQS-<time>-<random>.
  const reference = `LQS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
  await pool.query(
    "INSERT INTO payments (user_id, reference, amount_kobo, currency, status, feature, months, customer_email) VALUES (?, ?, ?, 'NGN', 'initialized', ?, ?, ?)",
    [user.id, reference, price * 100, feature.key, months, user.email])
  const tx = await paystack('/transaction/initialize', { method: 'POST', body: JSON.stringify({
    reference, email: user.email, amount: price * 100, currency: 'NGN',
    callback_url: `${appUrl(req)}/billing/callback`,
    metadata: { user_id: user.id, username: user.username, feature: feature.key, months, price,
      custom_fields: [{ display_name: 'Feature', variable_name: 'feature', value: `${feature.name} · ${months} month${months > 1 ? 's' : ''}` }] },
  }) })
  res.json({ url: tx.authorization_url })
})

app.get('/api/billing/history', auth, async (req, res) => {
  const [rows] = await pool.query(
    `SELECT reference, feature, months, amount_kobo / 100 AS amount, status, channel, card_type, last4, bank,
       DATE_FORMAT(COALESCE(paid_at, created_at), '%Y-%m-%d %H:%i') AS date
     FROM payments WHERE user_id = ? AND status <> 'initialized' ORDER BY id DESC LIMIT 50`, [req.userId])
  res.json(rows.map((p) => ({ ...p, amount: Number(p.amount), name: featureByKey[p.feature]?.name || p.feature })))
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
  const key = await applyPayment(tx)
  if (!key) return res.status(402).json({ error: `Payment not completed (${tx.status})` })
  res.json({ ok: true, feature: key, name: featureByKey[key].name, until: (await featureAccess(req.userId))[key] })
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
  const [[{ count }]] = await pool.query('SELECT COUNT(*) AS count FROM links WHERE user_id = ?', [req.userId])
  if (count >= FREE_LINK_LIMIT && !(await hasFeature(req.userId, 'unlimited_links')))
    return res.status(402).json({ error: `Free pages hold ${FREE_LINK_LIMIT} links. Unlock unlimited links from your dashboard.`, upgrade: true, feature: 'unlimited_links' })
  const [[{ next }]] = await pool.query(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM links WHERE user_id = ?', [req.userId])
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
  await pool.query('UPDATE links SET title = ?, url = ?, type = ? WHERE id = ? AND user_id = ?',
    [title.trim().slice(0, 100), url, type, req.params.id, req.userId])
  res.json({ ok: true })
})

app.delete('/api/links/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM links WHERE id = ? AND user_id = ?', [req.params.id, req.userId])
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
    `SELECT id, username, display_name, bio, layout, avatar_url, cover_url, theme, tags, ${PLAN_SQL}, note_body, note_sign, account_type, category, whatsapp, occupation, location, testimonials FROM users WHERE username = ?`,
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
  if ((await sessionUserId(req)) !== user.id && (await track(req, res, { userId: user.id, kind: 'view', ref: req.query.src === 'qr' ? 'qr' : String(req.query.ref || ''), consent: req.query.consent === '1', tz: String(req.query.tz || '') })))
    await pool.query('UPDATE users SET views = views + 1 WHERE id = ?', [user.id])
  const [links] = await pool.query(
    'SELECT id, title, url, type FROM links WHERE user_id = ? ORDER BY position, id', [user.id])
  res.json({ ...user, testimonials: parseList(user.testimonials), links })
})

app.post('/api/click/:id', clickLimiter, async (req, res) => {
  const [[link]] = await pool.query('SELECT id, user_id FROM links WHERE id = ?', [req.params.id])
  if (link && (await sessionUserId(req)) !== link.user_id && (await track(req, res, { userId: link.user_id, kind: 'click', linkId: link.id, ref: String(req.body?.ref || ''), consent: req.body?.consent === true, tz: String(req.body?.tz || '') })))
    await pool.query('UPDATE links SET clicks = clicks + 1 WHERE id = ?', [link.id])
  res.json({ ok: true })
})

app.get('/api/analytics', auth, async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 30
  if (days === 90 && !(await hasFeature(req.userId, 'analytics_90'))) return locked(res, 'analytics_90')
  const since = 'created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)'
  const args = [req.userId, days - 1]
  const [[{ today }]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today")
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS d, kind, COUNT(*) AS n FROM events WHERE user_id = ? AND ${since} GROUP BY d, kind`, args)
  // Fill every day in the range so the chart has no gaps.
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    const at = (k) => Number(rows.find((r) => r.d === key && r.kind === k)?.n || 0)
    series.push({ date: key, views: at('view'), clicks: at('click') })
  }
  const group = async (col, kind, limit = 6) => (await pool.query(
    `SELECT ${col} AS name, COUNT(*) AS n FROM events WHERE user_id = ? AND ${since} AND kind = ? GROUP BY ${col} ORDER BY n DESC LIMIT ${limit}`,
    [...args, kind]))[0].map((r) => ({ name: r.name, n: Number(r.n) }))
  const [links] = await pool.query(
    `SELECT l.id, l.title, l.type, COUNT(e.id) AS n FROM links l
     LEFT JOIN events e ON e.link_id = l.id AND e.kind = 'click' AND e.${since}
     WHERE l.user_id = ? GROUP BY l.id ORDER BY n DESC, l.position LIMIT 10`, [days - 1, req.userId])
  const [[{ visitors }]] = await pool.query(
    `SELECT COUNT(DISTINCT visitor) AS visitors FROM events WHERE user_id = ? AND ${since} AND kind = 'view' AND visitor <> ''`, args)
  const views = series.reduce((a, s) => a + s.views, 0)
  const clicks = series.reduce((a, s) => a + s.clicks, 0)

  // Best time: views/clicks by weekday × hour, in UTC (the browser shifts it to local time).
  const [heat] = await pool.query(
    `SELECT WEEKDAY(CONVERT_TZ(created_at, @@session.time_zone, '+00:00')) AS d, HOUR(CONVERT_TZ(created_at, @@session.time_zone, '+00:00')) AS h,
       SUM(kind = 'view') AS views, SUM(kind = 'click') AS clicks
     FROM events WHERE user_id = ? AND ${since} GROUP BY d, h`, args)

  // New vs returning (visitors who accepted the cookie): returning = seen before this range, or on 2+ days in it.
  const [[nr]] = await pool.query(
    `SELECT COUNT(*) AS total, SUM(returning_) AS returning_ FROM (
       SELECT e.visitor, (COUNT(DISTINCT DATE(e.created_at)) > 1 OR EXISTS (
         SELECT 1 FROM events p WHERE p.user_id = e.user_id AND p.visitor = e.visitor AND p.kind = 'view'
           AND p.created_at < DATE_SUB(CURDATE(), INTERVAL ? DAY))) AS returning_
       FROM events e WHERE e.user_id = ? AND e.kind = 'view' AND e.visitor <> '' AND e.${since} GROUP BY e.visitor) v`,
    [days - 1, req.userId, days - 1])

  // This week vs the week before, for the summary line.
  const [[wk]] = await pool.query(
    `SELECT SUM(kind = 'view' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS v_now,
            SUM(kind = 'view' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS v_prev,
            SUM(kind = 'click' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS c_now,
            SUM(kind = 'click' AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS c_prev
     FROM events WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)`, [req.userId])
  const [[best]] = await pool.query(
    `SELECT l.title, COUNT(*) AS n FROM events e JOIN links l ON l.id = e.link_id
     WHERE e.user_id = ? AND e.kind = 'click' AND e.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
     GROUP BY l.id ORDER BY n DESC LIMIT 1`, [req.userId])
  const change = (now, prev) => (Number(prev) ? Math.round(((Number(now) - Number(prev)) / Number(prev)) * 100) : null)
  const [[{ qr }]] = await pool.query(`SELECT COUNT(*) AS qr FROM events WHERE user_id = ? AND ${since} AND kind = 'view' AND referrer = 'qr'`, args)

  res.json({
    days, series, views, clicks, visitors: Number(visitors), qrScans: Number(qr),
    heat: heat.map((h) => ({ d: Number(h.d), h: Number(h.h), views: Number(h.views), clicks: Number(h.clicks) })),
    audience: { total: Number(nr.total || 0), returning: Number(nr.returning_ || 0) },
    week: {
      views: Number(wk.v_now || 0), clicks: Number(wk.c_now || 0),
      viewsChange: change(wk.v_now, wk.v_prev), clicksChange: change(wk.c_now, wk.c_prev),
      bestLink: best ? { title: best.title, clicks: Number(best.n) } : null,
    },
    // Conversion: share of page views in this range that clicked each link.
    links: links.map((l) => ({ ...l, n: Number(l.n), rate: views ? Number(l.n) / views : 0 })),
    referrers: await group('referrer', 'view'),
    devices: await group('device', 'view', 3),
    countries: await group('country', 'view', 10),
  })
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
  const [[{ links }]] = await pool.query('SELECT COUNT(*) AS links FROM links')
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
       SUM(EXISTS (SELECT 1 FROM links l WHERE l.user_id = u.id)) AS first_link,
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
  const byFeature = await q(
    `SELECT feature AS name, COALESCE(SUM(amount_kobo), 0) / 100 AS n FROM payments
     WHERE status = 'success' AND paid_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY feature ORDER BY n DESC`, [days - 1])
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
    payments: (await q(`SELECT p.reference, p.paystack_id, u.username, p.customer_email, p.feature, p.months, p.amount_kobo / 100 AS amount,
        p.status, p.channel, p.card_type, p.last4, p.bank, p.gateway_response, DATE_FORMAT(COALESCE(p.paid_at, p.created_at), '%Y-%m-%d %H:%i') AS date
      FROM payments p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 30`)).map((p) => ({ ...p, amount: Number(p.amount), name: featureByKey[p.feature]?.name || p.feature })),
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

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }))

// ---- Serve the built frontend (production) ----
const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
app.use(express.static(dist, { maxAge: '1h', index: false, setHeaders: (res, file) => {
  if (file.includes(`${path.sep}assets${path.sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
} }))
// SPA fallback: any non-API GET returns the app so client-side routes like /contact and /:username work on refresh.
app.get('*', (req, res, next) => {
  res.sendFile(path.join(dist, 'index.html'), (err) => err && next())
})

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'Server error' })
})

export default app
