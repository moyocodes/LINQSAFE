import { Briefcase, Camera, Globe, GitBranch, Ghost, Headphones, Link2, MessageCircle, Music2, Phone, Pin, Play, Store, ThumbsUp, X } from 'lucide-react'

// lucide has no brand logos, so each platform gets a recognisable icon on its brand colour.
export const LINK_TYPES = {
  instagram: { label: 'Instagram', icon: Camera, bg: '#e1306c', hosts: ['instagram.com'] },
  tiktok: { label: 'TikTok', icon: Music2, bg: '#111111', hosts: ['tiktok.com'] },
  youtube: { label: 'YouTube', icon: Play, bg: '#ff0033', hosts: ['youtube.com', 'youtu.be'] },
  snapchat: { label: 'Snapchat', icon: Ghost, bg: '#f5c400', fg: '#111', hosts: ['snapchat.com'] },
  pinterest: { label: 'Pinterest', icon: Pin, bg: '#e60023', hosts: ['pinterest.com', 'pin.it'] },
  x: { label: 'X / Twitter', icon: X, bg: '#111111', hosts: ['x.com', 'twitter.com'] },
  facebook: { label: 'Facebook', icon: ThumbsUp, bg: '#1877f2', hosts: ['facebook.com', 'fb.com', 'fb.me'] },
  linkedin: { label: 'LinkedIn', icon: Briefcase, bg: '#0a66c2', hosts: ['linkedin.com'] },
  github: { label: 'GitHub', icon: GitBranch, bg: '#24292f', hosts: ['github.com'] },
  whatsapp: { label: 'WhatsApp', icon: Phone, bg: '#25d366', hosts: ['wa.me', 'whatsapp.com'] },
  music: { label: 'Music', icon: Headphones, bg: '#1db954', hosts: ['spotify.com', 'soundcloud.com', 'music.apple.com'] },
  store: { label: 'Store / Shop', icon: Store, bg: '#7c5cff', hosts: [] },
  website: { label: 'Website', icon: Globe, bg: '#2a201c', hosts: [] },
  other: { label: 'Other', icon: Link2, bg: '#6b7280', hosts: [] },
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

export function TypeBadge({ type, className = 'size-9' }) {
  const t = LINK_TYPES[type] || LINK_TYPES.website
  const Icon = t.icon
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${className}`} style={{ background: t.bg, color: t.fg || '#fff' }} title={t.label}>
      <Icon className="size-1/2" aria-hidden="true" />
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
