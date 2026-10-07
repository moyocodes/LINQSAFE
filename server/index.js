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
import 'dotenv/config'
import { pool } from './db.js'

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
        'img-src': ["'self'", 'data:', 'blob:'],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
  })
)
app.use(compression())
// Same-origin by default. Set CORS_ORIGIN (comma-separated) only if the frontend is hosted elsewhere.
if (process.env.CORS_ORIGIN) app.use(cors({ origin: process.env.CORS_ORIGIN.split(',') }))
app.use(express.json({ limit: '20kb' }))

const limiter = (windowMs, limit, message) =>
  rateLimit({ windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: message } })
app.use('/api', limiter(60_000, 300, 'Too many requests, please slow down.'))
const authLimiter = limiter(15 * 60_000, 30, 'Too many attempts, try again in a few minutes.')
const contactLimiter = limiter(60 * 60_000, 5, 'You have sent a few messages already. Please try again later.')

// Usernames that would collide with site pages or static files.
const RESERVED = new Set([
  'admin', 'api', 'login', 'logout', 'signup', 'register', 'contact', 'terms', 'privacy', 'about', 'help',
  'support', 'settings', 'dashboard', 'assets', 'static', 'public', 'index', 'home', 'www', 'mail', 'root',
  '404', 'status', 'blog', 'pricing', 'security',
])
const sign = (user) => jwt.sign({ id: user.id }, SECRET, { expiresIn: '7d' })

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '')
  try {
    req.userId = jwt.verify(token, SECRET).id
    next()
  } catch {
    res.status(401).json({ error: 'Not authenticated' })
  }
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
  const { username, password, email = '' } = req.body
  if (!/^[a-z0-9_]{3,32}$/i.test(username || ''))
    return res.status(400).json({ error: 'Username must be 3-32 letters, numbers or underscores' })
  if (RESERVED.has(username.toLowerCase()))
    return res.status(400).json({ error: 'That username is reserved, please choose another' })
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.length > 254)
    return res.status(400).json({ error: 'Please enter a valid email address' })
  if ((password || '').length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  try {
    const hash = await bcrypt.hash(password, 10)
    const [r] = await pool.query(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      [username.toLowerCase(), email.trim().toLowerCase(), hash, username]
    )
    res.json({ token: sign({ id: r.insertId }) })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: /email/.test(e.message) ? 'That email is already registered' : 'Username taken' })
    console.error(e)
    res.status(500).json({ error: 'Server error' })
  }
})

app.post('/api/login', authLimiter, async (req, res) => {
  const { username, password } = req.body
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [
    (username || '').toLowerCase(),
  ])
  const user = rows[0]
  if (!user || !(await bcrypt.compare(password || '', user.password_hash)))
    return res.status(401).json({ error: 'Invalid username or password' })
  res.json({ token: sign(user) })
})

// ---- Admin (authenticated) ----
app.get('/api/me', auth, async (req, res) => {
  const [[user]] = await pool.query(
    'SELECT id, username, display_name, bio FROM users WHERE id = ?', [req.userId])
  const [links] = await pool.query(
    'SELECT id, title, url, clicks FROM links WHERE user_id = ? ORDER BY position, id', [req.userId])
  res.json({ ...user, links })
})

app.put('/api/profile', auth, async (req, res) => {
  const { display_name = '', bio = '' } = req.body
  await pool.query('UPDATE users SET display_name = ?, bio = ? WHERE id = ?', [
    display_name.slice(0, 80), bio.slice(0, 255), req.userId])
  res.json({ ok: true })
})

app.post('/api/links', auth, async (req, res) => {
  const { title, url } = req.body
  if (!title?.trim() || !validUrl(url))
    return res.status(400).json({ error: 'Title and a valid http(s) URL are required' })
  const [[{ next }]] = await pool.query(
    'SELECT COALESCE(MAX(position), 0) + 1 AS next FROM links WHERE user_id = ?', [req.userId])
  const [r] = await pool.query(
    'INSERT INTO links (user_id, title, url, position) VALUES (?, ?, ?, ?)',
    [req.userId, title.trim().slice(0, 100), url, next])
  res.json({ id: r.insertId, title, url, clicks: 0 })
})

app.put('/api/links/:id', auth, async (req, res) => {
  const { title, url } = req.body
  if (!title?.trim() || !validUrl(url))
    return res.status(400).json({ error: 'Title and a valid http(s) URL are required' })
  await pool.query('UPDATE links SET title = ?, url = ? WHERE id = ? AND user_id = ?',
    [title.trim().slice(0, 100), url, req.params.id, req.userId])
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
    'SELECT id, username, display_name, bio FROM users WHERE username = ?',
    [req.params.username.toLowerCase()])
  if (!user) return res.status(404).json({ error: 'Profile not found' })
  const [links] = await pool.query(
    'SELECT id, title, url FROM links WHERE user_id = ? ORDER BY position, id', [user.id])
  res.json({ ...user, links })
})

app.post('/api/click/:id', async (req, res) => {
  await pool.query('UPDATE links SET clicks = clicks + 1 WHERE id = ?', [req.params.id])
  res.json({ ok: true })
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

const port = process.env.PORT || 3001
const server = app.listen(port, () => console.log(`Server running on http://localhost:${port}`))
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => server.close(() => pool.end().then(() => process.exit(0))))
