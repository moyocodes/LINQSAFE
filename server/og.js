// Link-preview cards (1200×630 PNG) for public profiles, so a pasted linqsafe.com/name shows the logo,
// the person's photo, name, bio and platform icons on X, Snapchat, WhatsApp, iMessage, Slack, LinkedIn…
// Drawn as SVG and rendered with resvg using the brand fonts in server/assets/fonts (OFL).
// resvg is optional: if it isn't installed yet (cPanel: Run JS script → deps), previews use /og-image.png.
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import * as icons from 'simple-icons'

let Resvg = null
try { ({ Resvg } = await import('@resvg/resvg-js')) } catch { console.warn('@resvg/resvg-js not installed: profile previews use og-image.png') }

const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets', 'fonts')
const fontFiles = [path.join(FONTS, 'DMSans.ttf'), path.join(FONTS, 'Fraunces.ttf')]
export const ogAvailable = () => !!Resvg

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

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

// The logo mark from src/components/Logo.jsx, at 64×64.
const LOGO = `<rect width="64" height="64" rx="16" fill="#2B4FAF"/>
  <g stroke="#F2B88C" stroke-width="4" stroke-linecap="round" fill="none"><path d="M32 34V16"/><path d="M32 34 17 44"/><path d="M32 34l15 10"/></g>
  <circle cx="32" cy="34" r="7" fill="#F2B88C"/><circle cx="32" cy="14" r="5" fill="#F2D29A"/><circle cx="15" cy="45" r="5" fill="#6CC3BA"/><circle cx="49" cy="45" r="5" fill="#F2D29A"/>`

function cardSvg({ name, handle, line, bio, avatar, links, domain }) {
  const icons = platformIcons(links)
  const bioLines = lines(bio, 46)
  const nameSize = name.length > 18 ? 64 : 80
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="g1" cx="85%" cy="5%" r="55%"><stop offset="0" stop-color="#F2A07E" stop-opacity=".55"/><stop offset="1" stop-color="#F2A07E" stop-opacity="0"/></radialGradient>
    <radialGradient id="g2" cx="5%" cy="100%" r="60%"><stop offset="0" stop-color="#93ACCF" stop-opacity=".6"/><stop offset="1" stop-color="#93ACCF" stop-opacity="0"/></radialGradient>
    <radialGradient id="g3" cx="40%" cy="45%" r="35%"><stop offset="0" stop-color="#6CC3BA" stop-opacity=".18"/><stop offset="1" stop-color="#6CC3BA" stop-opacity="0"/></radialGradient>
    <clipPath id="av"><circle cx="230" cy="285" r="130"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#F6F3EE"/>
  <rect width="1200" height="630" fill="url(#g1)"/><rect width="1200" height="630" fill="url(#g2)"/><rect width="1200" height="630" fill="url(#g3)"/>
  <rect x="36" y="36" width="1128" height="558" rx="28" fill="none" stroke="#261F1C" stroke-opacity=".10" stroke-width="2"/>

  <circle cx="230" cy="285" r="142" fill="#FFFFFF"/>
  ${avatar
    ? `<image href="${avatar}" x="100" y="155" width="260" height="260" preserveAspectRatio="xMidYMid slice" clip-path="url(#av)"/>`
    : `<circle cx="230" cy="285" r="130" fill="#261F1C"/><text x="230" y="320" text-anchor="middle" font-family="Fraunces" font-size="110" fill="#F6F3EE">${esc(name[0]?.toUpperCase() || '?')}</text>`}

  <text x="420" y="${bioLines.length ? 228 : 260}" font-family="Fraunces" font-size="${nameSize}" fill="#261F1C">${esc(clip(name, 24))}</text>
  <text x="422" y="${bioLines.length ? 278 : 312}" font-family="DM Sans" font-size="28" fill="#2B4FAF">${esc(handle)}${line ? `<tspan fill="#261F1C" fill-opacity=".55">  ·  ${esc(clip(line, 34))}</tspan>` : ''}</text>
  ${bioLines.map((l, i) => `<text x="422" y="${330 + i * 40}" font-family="DM Sans" font-size="30" fill="#261F1C" fill-opacity=".72">${esc(l)}</text>`).join('\n  ')}
  ${icons.map((ic, i) => `<g transform="translate(${422 + i * 70}, ${bioLines.length ? 395 : 350})"><circle cx="28" cy="28" r="28" fill="${ic.bg}"/><g transform="translate(14,14) scale(1.1667)"><path d="${ic.path}" fill="${ic.fg}"/></g></g>`).join('\n  ')}

  <g transform="translate(72, 506)"><g transform="scale(0.875)">${LOGO}</g>
    <text x="72" y="40" font-family="Fraunces" font-size="34" fill="#261F1C">linqsafe<tspan fill="#2B4FAF">.</tspan></text></g>
  <g transform="translate(${1128 - 30 - (domain.length + handle.length) * 15.2}, 500)">
    <rect width="${(domain.length + handle.length) * 15.2 + 30}" height="64" rx="32" fill="#261F1C"/>
    <text x="${((domain.length + handle.length) * 15.2 + 30) / 2}" y="42" text-anchor="middle" font-family="DM Sans" font-size="26" fill="#F6F3EE">${esc(domain)}/<tspan fill="#F2B88C">${esc(handle.slice(1))}</tspan></text>
  </g>
</svg>`
}

function render(svg) {
  return new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'DM Sans' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng()
}

// A short fingerprint of what's on the card, so share URLs change (and apps refetch) when the profile does.
export const ogSignature = (u) => crypto.createHash('sha1')
  .update([u.display_name, u.bio, u.occupation, u.location, u.avatar_url?.length, u.avatar_url?.slice(-40), u.links.map((l) => l.type).join()].join('|'))
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
      png = render(cardSvg({ ...data, avatar: await avatarData(u.avatar_url) }))
    } catch {
      png = render(cardSvg({ ...data, avatar: null })) // e.g. an image format resvg can't decode
    }
    if (cache.size > 300) cache.delete(cache.keys().next().value)
    cache.set(u.username, { sig, png, at: Date.now() })
    res.type('png').set('Cache-Control', 'public, max-age=3600').send(png)
  }

  return { image }
}
