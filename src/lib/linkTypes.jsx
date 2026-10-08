import { useEffect, useState } from 'react'
import { Globe, Headphones, Link2, Store } from 'lucide-react'
import { siFacebook, siGithub, siInstagram, siPinterest, siSnapchat, siThreads, siTiktok, siWhatsapp, siX, siYoutube } from 'simple-icons'

// Real brand logos (Simple Icons, CC0) drawn as 24×24 SVGs. LinkedIn isn't in Simple Icons, so its
// standard "in" mark is inlined. Generic types (shop, website, music, other) use line icons.
const LINKEDIN = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
const brand = (path) => function BrandIcon({ className = 'size-5', ...rest }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" {...rest}><path d={path} /></svg>
}

export const LINK_TYPES = {
  instagram: { label: 'Instagram', icon: brand(siInstagram.path), bg: 'linear-gradient(45deg,#FEDA75,#FA7E1E 30%,#D62976 60%,#962FBF 80%,#4F5BD5)', hosts: ['instagram.com'] },
  threads: { label: 'Threads', icon: brand(siThreads.path), bg: '#000000', hosts: ['threads.net', 'threads.com'] },
  tiktok: { label: 'TikTok', icon: brand(siTiktok.path), bg: '#000000', hosts: ['tiktok.com'] },
  youtube: { label: 'YouTube', icon: brand(siYoutube.path), bg: '#FF0000', hosts: ['youtube.com', 'youtu.be'] },
  snapchat: { label: 'Snapchat', icon: brand(siSnapchat.path), bg: '#FFFC00', fg: '#000000', hosts: ['snapchat.com'] },
  pinterest: { label: 'Pinterest', icon: brand(siPinterest.path), bg: '#E60023', hosts: ['pinterest.com', 'pin.it'] },
  x: { label: 'X / Twitter', icon: brand(siX.path), bg: '#000000', hosts: ['x.com', 'twitter.com'] },
  facebook: { label: 'Facebook', icon: brand(siFacebook.path), bg: '#0866FF', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  linkedin: { label: 'LinkedIn', icon: brand(LINKEDIN), bg: '#0A66C2', hosts: ['linkedin.com'] },
  github: { label: 'GitHub', icon: brand(siGithub.path), bg: '#181717', hosts: ['github.com'] },
  whatsapp: { label: 'WhatsApp', icon: brand(siWhatsapp.path), bg: '#25D366', hosts: ['wa.me', 'whatsapp.com'] },
  music: { label: 'Music', icon: Headphones, bg: '#1DB954', hosts: ['spotify.com', 'soundcloud.com', 'music.apple.com'] },
  store: { label: 'Store / Shop', icon: Store, bg: '#2B4FAF', hosts: [] },
  website: { label: 'Website', icon: Globe, bg: '#261F1C', hosts: [] },
  other: { label: 'Other', icon: Link2, bg: '#6B625D', hosts: [] },
}

export const TYPE_KEYS = Object.keys(LINK_TYPES)
export const SOCIAL_KEYS = TYPE_KEYS.filter((k) => LINK_TYPES[k].hosts.length)

// Returns a known social type for the URL, or '' when we can't tell (the user then chooses).
export function detectType(url) {
  try {
    const host = new URL(url).hostname.replace(/^(www|m|open|vm)\./, '')
    return SOCIAL_KEYS.find((k) => LINK_TYPES[k].hosts.some((h) => host === h || host.endsWith(`.${h}`))) || ''
  } catch {
    return ''
  }
}

// Generic links (website, other, shop) show the site's own icon when it has one, via our server's cache.
const FAVICON_TYPES = ['website', 'other', 'store']
export const hostOf = (url) => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.hostname.replace(/^www\./, '') : '' } catch { return '' } }

export function TypeBadge({ type, url, icon, className = 'size-9' }) {
  const t = LINK_TYPES[type] || LINK_TYPES.website
  const Icon = t.icon
  // The owner's own logo / thumbnail for this link wins over the brand icon.
  if (icon) return (
    <span className={`block shrink-0 overflow-hidden rounded-full bg-white ring-1 ring-black/10 ${className}`} title={t.label}>
      <img src={icon} alt="" loading="lazy" className="size-full object-cover" />
      <span className="sr-only">{t.label}</span>
    </span>
  )
  const host = url && FAVICON_TYPES.includes(type) ? hostOf(url) : ''
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [host])
  if (host && !failed) {
    return (
      <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-1 ring-black/10 ${className}`} title={host}>
        <img src={`/api/favicon/${host}`} alt="" loading="lazy" onError={() => setFailed(true)} className="size-[60%] object-contain" />
        <span className="sr-only">{t.label}</span>
      </span>
    )
  }
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${className}`} style={{ background: t.bg, color: t.fg || '#fff' }} title={t.label}>
      <Icon className="size-[52%]" aria-hidden="true" />
      <span className="sr-only">{t.label}</span>
    </span>
  )
}

export function TypeSelect({ value, onChange, id, required, ...rest }) {
  return (
    <select
      id={id} required={required} value={value} onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" {...rest}
    >
      {!value && <option value="" disabled>Choose a type…</option>}
      <optgroup label="Social media">
        {SOCIAL_KEYS.map((k) => <option key={k} value={k}>{LINK_TYPES[k].label}</option>)}
      </optgroup>
      <optgroup label="Other">
        {['music', 'store', 'website', 'other'].filter((k) => !SOCIAL_KEYS.includes(k)).map((k) => <option key={k} value={k}>{LINK_TYPES[k].label}</option>)}
      </optgroup>
    </select>
  )
}
