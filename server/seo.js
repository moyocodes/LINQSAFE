// Search engines and link previews.
// The site is a single-page app, so crawlers and chat apps (WhatsApp, X, Facebook, LinkedIn, Slack) that
// don't run JavaScript would all see the same generic page. Before index.html is sent, we fill the block
// between <!--seo--> and <!--/seo--> with the right title, description, share image, canonical URL and
// structured data for that URL, including each user's public profile. robots.txt and sitemap.xml are
// generated here too. dev.* and admin.* hosts are never indexed.
import fs from 'node:fs'
import path from 'node:path'
import { ogAvailable, ogSignature } from './og.js'

const NAME = 'linqsafe'
const TAGLINE = 'One link for everything you share'
const DEFAULT_DESC = 'Create a beautiful, fast page that holds all your links: socials, shop, WhatsApp and more. Share it anywhere with a single URL.'

// Public pages with their own title/description. Everything else that isn't a profile is private.
const PAGES = {
  '/': { title: `${NAME} — ${TAGLINE}`, desc: DEFAULT_DESC, priority: '1.0' },
  '/pricing': { title: `Pricing · ${NAME}`, desc: 'Start free. Add features like unlimited links, premium templates and a QR code for 1, 3, 6 or 12 months. Paid in naira, no subscription.', priority: '0.8' },
  '/signup': { title: `Create your page · ${NAME}`, desc: 'Pick a username and get your link-in-bio page in under a minute. Free to start.', priority: '0.7' },
  '/login': { title: `Log in · ${NAME}`, desc: `Log in to manage your ${NAME} page.`, priority: '0.3' },
  '/contact': { title: `Contact · ${NAME}`, desc: `Questions about ${NAME}? Send us a message.`, priority: '0.4' },
  '/terms': { title: `Terms of Service · ${NAME}`, desc: `The terms for using ${NAME}.`, priority: '0.2' },
  '/privacy': { title: `Privacy Policy · ${NAME}`, desc: `What ${NAME} collects, why, and the choices you have.`, priority: '0.2' },
}
const PRIVATE = /^\/(admin|owner|verify|forgot-password|reset-password|billing|404)(\/|$)/

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// JSON inside <script> must not be able to close the tag.
const jsonLd = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

// dev.linqsafe.com, admin.linqsafe.com, admin-dev.… and localhost previews must stay out of search results.
export const indexable = (host) => !/^(dev|admin)([.-]|$)/.test(host)

export function baseUrl(req) {
  if (process.env.APP_URL && indexable(req.hostname)) return process.env.APP_URL.replace(/\/$/, '')
  return `${req.protocol}://${req.get('host')}`
}

// Including common misspellings people search for (linksafe, linq safe).
const KEYWORDS = 'linqsafe, linksafe, linq safe, link safe, link in bio, bio link, one link for everything, links page, WhatsApp link, Nigeria'

function block({ title, desc, url, image, imageAlt, type = 'website', noindex, ld = [], square = false }) {
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    `<meta name="keywords" content="${KEYWORDS}" />`,
    noindex ? '<meta name="robots" content="noindex, nofollow" />' : '<meta name="robots" content="index, follow, max-image-preview:large" />',
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${NAME}" />`,
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:image:secure_url" content="${esc(image)}" />`,
    ...(square ? [] : ['<meta property="og:image:type" content="image/png" />', '<meta property="og:image:width" content="1200" />', '<meta property="og:image:height" content="630" />']),
    `<meta property="og:image:alt" content="${esc(imageAlt || title)}" />`,
    '<meta property="og:locale" content="en_NG" />',
    `<meta name="twitter:card" content="${square ? 'summary' : 'summary_large_image'}" />`,
    `<meta name="twitter:title" content="${esc(title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ...ld.map(jsonLd),
  ].join('\n    ')
}

let template = null
function readTemplate(dist) {
  // Read once per process; a deploy always restarts the app.
  if (!template) template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
  return template
}

export function createSeo({ pool, dist }) {
  // The public fields we need for a profile preview. Mirrors what /api/u/:username exposes.
  async function profile(username) {
    if (!/^[a-z0-9_]{3,32}$/i.test(username)) return null
    const [[u]] = await pool.query(
      'SELECT id, username, display_name, bio, avatar_url, account_type, occupation, location FROM users WHERE username = ? AND email_verified = 1 AND deleted_at IS NULL', [username.toLowerCase()])
    if (!u) return null
    const [links] = await pool.query("SELECT url, type FROM links WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, id", [u.id])
    return { ...u, links }
  }

  async function meta(req) {
    const base = baseUrl(req)
    const p = req.path.replace(/\/+$/, '') || '/'
    const url = base + (p === '/' ? '/' : p)
    const image = `${base}/og-image.png`
    const noindex = !indexable(req.hostname)

    if (PAGES[p]) {
      const ld = p === '/' ? [
        { '@context': 'https://schema.org', '@type': 'WebSite', name: NAME, url: `${base}/`, description: DEFAULT_DESC },
        { '@context': 'https://schema.org', '@type': 'Organization', name: NAME, url: `${base}/`, logo: `${base}/icon-512.png`, email: 'support@linqsafe.com' },
      ] : []
      return { html: block({ ...PAGES[p], url, image, noindex, ld }), status: 200 }
    }
    if (PRIVATE.test(p)) return { html: block({ title: NAME, desc: DEFAULT_DESC, url, image, noindex: true }), status: 200 }

    // /username → that person's public page.
    const m = p.match(/^\/([A-Za-z0-9_]+)$/)
    const u = m && (await profile(m[1]))
    if (!u) return { html: block({ title: `Page not found · ${NAME}`, desc: DEFAULT_DESC, url, image, noindex: true }), status: 404 }

    const name = u.display_name || u.username
    const about = [u.occupation, u.location].filter(Boolean).join(' · ')
    const desc = clip(u.bio || (about ? `${name}: ${about}.` : `${name}'s links, all in one place.`), 160)
    // Uploaded pictures are stored as data: URLs, which previews can't use, so they're served from /api/u/:username/avatar.
    const avatar = u.avatar_url ? (u.avatar_url.startsWith('data:') ? `${base}/api/u/${u.username}/avatar` : u.avatar_url) : null
    const business = u.account_type === 'business'
    const ld = [{
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url,
      name: `${name} (@${u.username})`,
      mainEntity: {
        '@type': business ? 'Organization' : 'Person',
        name,
        alternateName: `@${u.username}`,
        ...(u.bio && { description: u.bio }),
        ...(avatar && { image: avatar }),
        ...(u.occupation && !business && { jobTitle: u.occupation }),
        ...(u.location && { address: { '@type': 'PostalAddress', addressLocality: u.location } }),
        sameAs: u.links.filter((l) => l.type !== 'website' && l.type !== 'other' && /^https?:/i.test(l.url)).map((l) => l.url).slice(0, 10),
        url,
      },
    }]
    return {
      // A branded 1200×630 card (logo, photo, name, icons) when the renderer is installed; else the photo or site image.
      html: block({
        title: `${name} (@${u.username}) · ${NAME}`, desc, url, type: 'profile', noindex, ld,
        ...(ogAvailable()
          ? { image: `${base}/og/${u.username}.png?v=${ogSignature(u)}`, imageAlt: `${name} on ${NAME}` }
          : { image: avatar || image, imageAlt: `${name}'s profile picture`, square: !!avatar }),
      }),
      status: 200,
    }
  }

  // Express handler for every page request (the SPA fallback).
  async function page(req, res, next) {
    let html
    try {
      html = readTemplate(dist)
    } catch {
      return next() // no build (local dev uses Vite instead)
    }
    let seo
    try {
      seo = await meta(req)
    } catch (e) {
      console.error('seo:', e.message)
      seo = { html: block({ title: `${NAME} — ${TAGLINE}`, desc: DEFAULT_DESC, url: baseUrl(req) + req.path, image: `${baseUrl(req)}/og-image.png` }), status: 200 }
    }
    res.status(seo.status).type('html').set('Cache-Control', 'no-cache')
      .send(html.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, `<!--seo-->\n    ${seo.html}\n    <!--/seo-->`))
  }

  function robots(req, res) {
    res.type('text/plain').set('Cache-Control', 'public, max-age=3600')
    if (!indexable(req.hostname)) return res.send('# Not for search engines.\nUser-agent: *\nDisallow: /\n')
    res.send([
      'User-agent: *',
      'Allow: /',
      ...['/admin', '/owner', '/api/', '/billing/', '/verify', '/forgot-password', '/reset-password'].map((d) => `Disallow: ${d}`),
      'Allow: /api/u/', // profile pictures used in previews
      'Allow: /og/', // link-preview cards
      '',
      `Sitemap: ${baseUrl(req)}/sitemap.xml`,
      '',
    ].join('\n'))
  }

  async function sitemap(req, res) {
    if (!indexable(req.hostname)) return res.status(404).type('text/plain').send('Not found')
    const base = baseUrl(req)
    // Profiles worth indexing: at least one link. lastmod = newest link (or signup).
    const [rows] = await pool.query(
      `SELECT u.username, DATE_FORMAT(GREATEST(u.created_at, COALESCE(MAX(l.created_at), u.created_at)), '%Y-%m-%d') AS lastmod
       FROM users u JOIN links l ON l.user_id = u.id AND l.deleted_at IS NULL WHERE u.email_verified = 1 AND u.deleted_at IS NULL GROUP BY u.id ORDER BY u.id LIMIT 45000`)
    const url = (loc, extra = '') => `  <url><loc>${esc(loc)}</loc>${extra}</url>`
    res.type('application/xml').set('Cache-Control', 'public, max-age=3600').send([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...Object.entries(PAGES).map(([p, v]) => url(base + p, `<priority>${v.priority}</priority>`)),
      ...rows.map((r) => url(`${base}/${r.username}`, `<lastmod>${r.lastmod}</lastmod><priority>0.6</priority>`)),
      '</urlset>',
      '',
    ].join('\n'))
  }

  // Serves an uploaded profile picture (stored as a data: URL) as a real image, for link previews.
  async function avatar(req, res) {
    const [[u]] = await pool.query('SELECT avatar_url FROM users WHERE username = ? AND email_verified = 1 AND deleted_at IS NULL', [String(req.params.username).toLowerCase()])
    const m = u?.avatar_url?.match(/^data:(image\/(?:webp|jpeg|png));base64,(.+)$/)
    if (!m) return res.status(404).end()
    res.type(m[1]).set('Cache-Control', 'public, max-age=86400').send(Buffer.from(m[2], 'base64'))
  }

  return { page, robots, sitemap, avatar }
}
