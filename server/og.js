// Link-preview cards (1200×630 PNG) for public profiles, so a pasted linqsafe.com/name shows the logo,
// the person's photo, name, bio and platform icons on X, Snapchat, WhatsApp, iMessage, Slack, LinkedIn…
// Drawn as SVG and rendered with resvg using the brand fonts in server/assets/fonts (OFL).
// resvg is optional: if it isn't installed yet (cPanel: Run JS script → deps), previews use /og-image.png.
import path from 'node:path'
import fsSync from 'node:fs'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as icons from 'simple-icons'

let Resvg = null
try { ({ Resvg } = await import('@resvg/resvg-js')) } catch { console.warn('@resvg/resvg-js not installed: profile previews use og-image.png') }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FONTS = path.join(HERE, 'assets', 'fonts')
// Montserrat is the geometric sans closest to the LINQSAFE wordmark; DM Sans fills in any glyph it lacks.
const fontFiles = ['Montserrat-ExtraBold.ttf', 'Montserrat-SemiBold.ttf', 'Montserrat-Medium.ttf', 'DMSans.ttf'].map((f) => path.join(FONTS, f))
export const ogAvailable = () => !!Resvg

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

// The logo's own colours (sampled from public/logo-wordmark.png).
const C = { navy: '#2B4257', blue: '#6DA7CC', blueInk: '#2F6E99', orange: '#FFA500', paper: '#F7F5F1' }
const FONT = 'Montserrat'

// Brand colours and Simple Icons paths for the platform row (same set as src/lib/linkTypes.jsx).
const BRANDS = {
  instagram: ['siInstagram', '#E1306C'], threads: ['siThreads', '#000000'], tiktok: ['siTiktok', '#000000'], youtube: ['siYoutube', '#FF0000'],
  snapchat: ['siSnapchat', '#FFFC00', '#000000'], pinterest: ['siPinterest', '#E60023'], x: ['siX', '#000000'],
  facebook: ['siFacebook', '#0866FF'], github: ['siGithub', '#181717'], whatsapp: ['siWhatsapp', '#25D366'], music: ['siSpotify', '#1DB954'],
}
const LINKEDIN = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zM7.119 20.452H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

function platformIcons(links) {
  const seen = new Set()
  const out = []
  for (const l of links) {
    if (seen.has(l.type) || out.length >= 6) continue
    if (l.type === 'linkedin') { seen.add(l.type); out.push({ path: LINKEDIN, bg: '#0A66C2', fg: '#fff' }); continue }
    const b = BRANDS[l.type]
    if (!b || !icons[b[0]]) continue
    seen.add(l.type)
    out.push({ path: icons[b[0]].path, bg: b[1], fg: b[2] || '#fff' })
  }
  return out
}

// Wrap a bio into at most two lines of roughly `width` characters.
function lines(text, width, max = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const out = ['']
  for (const w of words) {
    const cur = out[out.length - 1]
    if ((cur + ' ' + w).trim().length <= width) out[out.length - 1] = (cur + ' ' + w).trim()
    else if (out.length < max) out.push(w)
    else { out[out.length - 1] = clip(`${cur} ${w}`, width); break }
  }
  return out.filter(Boolean)
}

// The brand artwork, embedded from the built site (dist/, or public/ when there is no build) so the
// cards use the same files as the site rather than a copy drawn in code.
function embed(file) {
  for (const dir of ['dist', 'public']) {
    try { return `data:image/png;base64,${fsSync.readFileSync(path.join(HERE, '..', dir, file)).toString('base64')}` } catch { /* try the next */ }
  }
  return '' // no artwork next to the server: cards simply omit the logo
}
const WORDMARK_DARK = embed('logo-wordmark-dark.png')

// The cream-lettered wordmark with its ink (962x317 at 127,19 inside 1186x356) placed at x, y, `h` tall.
function wordmark(x, y, h) {
  if (!WORDMARK_DARK) return `<text x="${x}" y="${y + h * 0.8}" font-family="${FONT}" font-weight="800" font-size="${h * 0.8}" fill="${C.paper}">LINQSAFE</text>`
  const s = h / 317
  return `<image href="${WORDMARK_DARK}" x="${(x - 127 * s).toFixed(2)}" y="${(y - 19 * s).toFixed(2)}" width="${(1186 * s).toFixed(2)}" height="${(356 * s).toFixed(2)}"/>`
}

// The logo's folded ribbons, blown up as a corner motif: bands rising at 30° with upright ends,
// blue and orange like the mark's S.
function ribbon(x, y, len, t, fill) {
  const r = len * Math.tan(Math.PI / 6)
  return `<path d="M${x} ${y} L${x + len} ${y - r} V${y - r + t} L${x} ${y + t} Z" fill="${fill}"/>`
}
const RIBBONS = `<g>
    ${ribbon(1010, 92, 220, 34, C.blue)}
    ${ribbon(1060, 160, 170, 34, C.orange)}
  </g>`

// The shared frame: paper, the ribbon corner, and a navy footer band with the wordmark and the address.
function frame(body, { domain, handle }) {
  const url = `${domain}/`
  const w = Math.round((url.length + handle.length) * 16.2 + 56)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${C.paper}"/>
  ${RIBBONS}
  ${body}
  <rect y="526" width="1200" height="104" fill="${C.navy}"/>
  ${wordmark(64, 546, 64)}
  <g transform="translate(${1136 - w}, 548)">
    <rect width="${w}" height="60" rx="30" fill="#FFFFFF" fill-opacity=".1" stroke="#FFFFFF" stroke-opacity=".22" stroke-width="2"/>
    <text x="${w / 2}" y="39" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="26" fill="${C.paper}">${esc(url)}<tspan fill="${C.orange}" font-weight="800">${esc(handle)}</tspan></text>
  </g>
</svg>`
}

const iconRow = (icons, x, y, size = 56) => icons.map((ic, i) =>
  `<g transform="translate(${x + i * (size + 14)}, ${y})"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${ic.bg}"/><g transform="translate(${size / 4},${size / 4}) scale(${size / 48})"><path d="${ic.path}" fill="${ic.fg}"/></g></g>`).join('\n  ')

function cardSvg({ name, handle, line, bio, avatar, links, domain }) {
  const icons = platformIcons(links)
  const bioLines = lines(bio, 40)
  const shown = clip(name, 24)
  const nameSize = Math.min(68, Math.floor(1000 / shown.length)) // ExtraBold runs ~0.68em a letter; keep it under ~680px
  // Name, handle line, bio and icons stacked and centred on the photo.
  const blockH = nameSize + 46 + bioLines.length * 40 + (icons.length ? 84 : 0)
  const top = 262 - blockH / 2 + nameSize * 0.78
  const hy = top + 50, by = hy + 50, iy = by + (bioLines.length ? bioLines.length * 40 - 6 : -24)
  return frame(`<defs><clipPath id="av"><circle cx="232" cy="262" r="140"/></clipPath></defs>
  <circle cx="232" cy="262" r="158" fill="${C.navy}"/>
  <circle cx="232" cy="262" r="150" fill="#FFFFFF"/>
  ${avatar
    ? `<image href="${avatar}" x="92" y="122" width="280" height="280" preserveAspectRatio="xMidYMid slice" clip-path="url(#av)"/>`
    : `<circle cx="232" cy="262" r="140" fill="${C.blue}"/><text x="232" y="306" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="120" fill="#FFFFFF">${esc(name[0]?.toUpperCase() || '?')}</text>`}

  <text x="440" y="${top}" font-family="${FONT}" font-weight="800" font-size="${nameSize}" letter-spacing="-1.5" fill="${C.navy}">${esc(shown)}</text>
  <text x="442" y="${hy}" font-family="${FONT}" font-weight="600" font-size="26" fill="${C.blueInk}">${esc(handle)}${line ? `<tspan fill="${C.navy}" fill-opacity=".6" font-weight="500" dx="14">·</tspan><tspan fill="${C.navy}" fill-opacity=".6" font-weight="500" dx="14">${esc(clip(line, 34))}</tspan>` : ''}</text>
  ${bioLines.map((l, i) => `<text x="442" y="${by + i * 40}" font-family="${FONT}" font-weight="500" font-size="27" fill="${C.navy}" fill-opacity=".78">${esc(l)}</text>`).join('\n  ')}
  ${iconRow(icons, 442, iy)}`, { domain, handle: handle.slice(1) })
}

// The site-wide card (public/og-image.png), for the home page and every page without its own.
// Rendered by `npm run og-image`; run it again after changing this or the logo.
export function siteCardSvg({ domain = 'linqsafe.com' } = {}) {
  const pill = (label, y, solid) => `<g transform="translate(0, ${y})">
      <rect width="300" height="54" rx="14" fill="${solid ? C.navy : '#FFFFFF'}" stroke="${C.navy}" stroke-opacity="${solid ? 0 : 0.14}" stroke-width="2"/>
      <text x="150" y="35" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="20" fill="${solid ? '#FFFFFF' : C.navy}">${label}</text></g>`
  const dots = [['#E1306C', 0], ['#000000', 1], ['#FF0000', 2], ['#25D366', 3]]
  return frame(`<text font-family="${FONT}" font-weight="800" font-size="76" letter-spacing="-2.5" fill="${C.navy}">
    <tspan x="64" y="150">One link for</tspan>
    <tspan x="64" y="236" fill="${C.orange}">everything</tspan>
    <tspan x="64" y="322">you share.</tspan>
  </text>
  <rect x="66" y="252" width="420" height="10" rx="5" fill="${C.blue}"/>
  <text x="66" y="402" font-family="${FONT}" font-weight="500" font-size="27" fill="${C.navy}" fill-opacity=".72">Socials, shop, WhatsApp and more,</text>
  <text x="66" y="440" font-family="${FONT}" font-weight="500" font-size="27" fill="${C.navy}" fill-opacity=".72">all on one page.</text>

  <g transform="translate(790, 70) rotate(4)">
    <rect x="6" y="14" width="340" height="420" rx="34" fill="${C.navy}" fill-opacity=".14"/>
    <rect width="340" height="420" rx="34" fill="#FFFFFF" stroke="${C.navy}" stroke-opacity=".12" stroke-width="2"/>
    <circle cx="170" cy="74" r="40" fill="${C.blue}"/>
    <text x="170" y="89" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="40" fill="#FFFFFF">A</text>
    <text x="170" y="148" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="24" fill="${C.navy}">Ada Bello</text>
    <text x="170" y="174" text-anchor="middle" font-family="${FONT}" font-weight="600" font-size="14" letter-spacing="2" fill="${C.navy}" fill-opacity=".5">DESIGN · TRAVEL · FOOD</text>
    ${dots.map(([c, i]) => `<circle cx="${122 + i * 32}" cy="204" r="11" fill="${c}"/>`).join('')}
    <g transform="translate(20, 236)">${pill('My latest video', 0)}${pill('Shop my picks', 66)}${pill('Chat on WhatsApp', 132, true)}</g>
  </g>`, { domain, handle: 'yourname' })
}

export function renderPng(svg) {
  return new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: FONT }, fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

// Bump when the card design changes, so every profile's share URL changes and apps refetch it.
const DESIGN = 2

// A short fingerprint of what's on the card, so share URLs change (and apps refetch) when the profile does.
export const ogSignature = (u) => crypto.createHash('sha1')
  .update([DESIGN, u.display_name, u.bio, u.occupation, u.location, u.avatar_url?.length, u.avatar_url?.slice(-40), u.links.map((l) => l.type).join()].join('|'))
  .digest('hex').slice(0, 10)

export function createOg({ pool }) {
  const cache = new Map() // username → { sig, png, at }

  async function profileData(username) {
    const [[u]] = await pool.query(
      'SELECT id, username, display_name, bio, avatar_url, occupation, location FROM users WHERE username = ? AND page_live = 1 AND suspended_at IS NULL AND deleted_at IS NULL', [username.toLowerCase()])
    if (!u) return null
    const [links] = await pool.query('SELECT type FROM links WHERE user_id = ? AND deleted_at IS NULL ORDER BY position, id', [u.id])
    return { ...u, links }
  }

  async function avatarData(url) {
    if (!url) return null
    if (/^data:image\/(png|jpeg|webp);base64,/.test(url)) return url
    if (!/^https?:\/\//.test(url)) return null
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(2500) })
      const type = r.headers.get('content-type') || ''
      if (!r.ok || !/^image\/(png|jpeg|webp)/.test(type)) return null
      const buf = Buffer.from(await r.arrayBuffer())
      return buf.length < 3_000_000 ? `data:${type.split(';')[0]};base64,${buf.toString('base64')}` : null
    } catch { return null }
  }

  // GET /og/:username.png
  async function image(req, res) {
    const username = String(req.params.username || '')
    if (!Resvg || !/^[a-z0-9_]{3,32}$/i.test(username)) return res.redirect(302, '/og-image.png')
    const u = await profileData(username)
    if (!u) return res.redirect(302, '/og-image.png')
    const sig = ogSignature(u)
    const hit = cache.get(u.username)
    if (hit && hit.sig === sig) return res.type('png').set('Cache-Control', 'public, max-age=3600').send(hit.png)

    const host = (process.env.APP_URL || `https://${req.get('host')}`).replace(/^https?:\/\//, '').replace(/\/$/, '')
    const data = {
      name: u.display_name || u.username, handle: `@${u.username}`, line: [u.occupation, u.location].filter(Boolean).join(' · '),
      bio: u.bio || '', links: u.links, domain: host,
    }
    let png
    try {
      png = renderPng(cardSvg({ ...data, avatar: await avatarData(u.avatar_url) }))
    } catch {
      png = renderPng(cardSvg({ ...data, avatar: null })) // e.g. an image format resvg can't decode
    }
    if (cache.size > 300) cache.delete(cache.keys().next().value)
    cache.set(u.username, { sig, png, at: Date.now() })
    res.type('png').set('Cache-Control', 'public, max-age=3600').send(png)
  }

  return { image }
}
