import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { BarChart3, Briefcase, Crown, Copy, LayoutTemplate, Link2, UserRound, Share2, Smartphone, X, MailWarning, Feather, MessageSquareQuote, QrCode, Eye, ExternalLink, Globe, MousePointerClick, Check, ChevronDown, ChevronUp, GripVertical, Loader2, LogOut, Plus, Trash2 } from 'lucide-react'
import { api, logout, setSignedIn } from '@/api'
import ShareButton from '@/ShareButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, IconChip } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'
import AvatarPicker from '@/components/AvatarPicker'
import QrCard from '@/components/QrCard'
import Onboarding from '@/components/Onboarding'
import { AccountFields, BillingProvider, StickySave, FeatureCard, FounderNoteEditor, PaymentHistory, SocialSuggestions, TemplatePicker, TestimonialsEditor, UnlockChip } from '@/components/ProFeatures'
import { FREE_LINK_LIMIT, has } from '@/lib/plans'
import { LINK_TYPES, TypeBadge, TypeSelect, detectType } from '@/lib/linkTypes'

function LinkRow({ link, index, total, onChange, onSave, onRemove, onMove, onDragEnd }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={link} dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="relative overflow-hidden rounded-lg border bg-card"
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,.12)', zIndex: 10 }}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden="true" />
        </button>
        <TypeBadge type={link.type} />
        <div className="grid flex-1 gap-2">
          <Input placeholder="Link title" aria-label={`Title for link ${index + 1}`} value={link.title} onChange={(e) => onChange({ title: e.target.value })} onBlur={onSave} />
          <Input placeholder="https://instagram.com/moyosore" aria-label={`URL for link ${index + 1}`} value={link.url} onChange={(e) => onChange({ url: e.target.value })}
            onBlur={() => { const t = detectType(link.url); if (t && t !== link.type) { onChange({ type: t }); onSave({ type: t }) } else onSave() }} />
          <TypeSelect aria-label={`Type for link ${index + 1}`} value={link.type || 'website'} onChange={(type) => { onChange({ type }); onSave({ type }) }} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Badge variant="secondary"><BarChart3 className="mr-1 size-3" aria-hidden="true" />{link.clicks}<span className="sr-only"> clicks</span></Badge>
          <div className="flex">
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${link.title || 'link'} up`} disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp /></Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${link.title || 'link'} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown /></Button>
            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${link.title || 'link'}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </Reorder.Item>
  )
}

function Preview({ me }) {
  const name = me.display_name || me.username
  const layout = me.layout || 'classic'
  const align = layout === 'minimal' ? '' : 'text-center'
  const tile = {
    classic: 'rounded-xl bg-white/80 px-3 py-2 text-center',
    grid: 'flex min-h-14 flex-col justify-center rounded-xl bg-white/80 p-2 text-center',
    minimal: 'border-b border-foreground/15 py-2 text-left',
  }[layout]
  return (
    <motion.div whileHover={{ y: -6, rotate: -1 }} whileTap={{ scale: 0.97 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Link
        to={`/${me.username}`} target="_blank" rel="noopener noreferrer"
        className="group relative mx-auto block w-[260px] rounded-[2.5rem] border-[6px] border-foreground/90 bg-gradient-to-b from-stone-100 to-stone-50 p-5 shadow-xl"
      >
        <span className="sr-only">Open your live page in a new tab</span>
        <span aria-hidden="true" className="mx-auto mb-1 block h-1.5 w-16 rounded-full bg-foreground/80" />
        <motion.div layout className={`mt-2 grid size-14 place-items-center overflow-hidden rounded-full bg-primary text-xl font-bold text-primary-foreground ${layout === 'minimal' ? '' : 'mx-auto'}`}>
          {me.avatar_url ? <img src={me.avatar_url} alt="" className="size-full object-cover" /> : name[0]?.toUpperCase()}
        </motion.div>
        <p aria-hidden="true" className={`mt-2 text-sm font-semibold ${align}`}>{name}</p>
        {me.bio && <p aria-hidden="true" className={`text-xs text-muted-foreground ${align}`}>{me.bio}</p>}
        <motion.div layout aria-hidden="true" className={`mt-4 min-h-[8rem] pb-3 ${layout === 'grid' ? 'grid grid-cols-2 gap-2' : layout === 'minimal' ? 'border-t border-foreground/15' : 'space-y-2'}`}>
          <AnimatePresence initial={false}>
            {me.links.map((l) => (
              <motion.span key={l.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                className={`flex min-w-0 items-center gap-1.5 text-xs font-medium shadow-sm ${tile}`}><TypeBadge type={l.type} className="size-5 shrink-0" /><span className="line-clamp-2 min-w-0 break-words">{l.title || 'Untitled'}</span></motion.span>
            ))}
          </AnimatePresence>
        </motion.div>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background opacity-0 transition-opacity group-hover:opacity-100">
          Open live page <ExternalLink className="size-3" />
        </span>
      </Link>
    </motion.div>
  )
}

function PreviewToolbar({ me, url, canQr }) {
  const [copied, setCopied] = useState(false)
  const [qr, setQr] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(url) } catch { window.prompt('Copy this link:', url); return }
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }
  async function downloadQr() {
    const { default: QRCode } = await import('qrcode')
    const a = document.createElement('a')
    a.href = await QRCode.toDataURL(`${url}?src=qr`, { width: 640, margin: 2 })
    a.download = `${me.username}-qr.png`
    a.click()
    setQr(true)
    setTimeout(() => setQr(false), 1400)
  }
  const share = () => (navigator.share ? navigator.share({ title: me.display_name || me.username, url }).catch(() => {}) : copy())
  const tools = [
    { label: 'Open', icon: ExternalLink, as: 'link', to: `/${me.username}` },
    { label: copied ? 'Copied' : 'Copy', icon: copied ? Check : Copy, onClick: copy },
    { label: 'Share', icon: Share2, onClick: share },
    canQr ? { label: qr ? 'Saved' : 'QR', icon: qr ? Check : QrCode, onClick: downloadQr } : { label: 'QR', icon: QrCode, as: 'link', to: '#qr', pro: true },
    { label: 'Stats', icon: BarChart3, as: 'link', to: '/admin/analytics' },
  ]
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
      role="toolbar" aria-label="Page actions"
      className="mx-auto mt-4 flex w-fit items-center gap-1 rounded-2xl border bg-card/90 p-1.5 shadow-lg backdrop-blur"
    >
      {tools.map(({ label, icon: Icon, onClick, as, to, pro: locked }, i) => {
        const inner = (
          <>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={label} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                <Icon className="size-4" aria-hidden="true" />
              </motion.span>
            </AnimatePresence>
            <span className="text-[10px] font-medium">{label}</span>
            {locked && <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-accent" aria-hidden="true" />}
          </>
        )
        const cls = 'relative flex w-12 flex-col items-center gap-0.5 rounded-xl py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }} whileHover={{ y: -2 }} whileTap={{ scale: 0.9 }}>
            {as === 'link'
              ? to.startsWith('#')
                ? <a href={to} className={cls} aria-label={locked ? 'QR code (locked)' : label}>{inner}</a>
                : <Link to={to} target={label === 'Open' ? '_blank' : undefined} className={cls} aria-label={label}>{inner}</Link>
              : <button type="button" onClick={onClick} className={cls}>{inner}</button>}
          </motion.div>
        )
      })}
    </motion.div>
  )
}

const SECTIONS = [
  ['overview', 'Overview', Eye], ['share', 'Share & QR', Share2], ['profile', 'Profile', UserRound], ['account', 'Account type', Briefcase],
  ['template', 'Template & theme', LayoutTemplate], ['links', 'Links', Link2],
  ['note', "Founder's note", Feather], ['testimonials', 'Kind words', MessageSquareQuote], ['payments', 'Payments', Crown],
]

// Jump-to menu for the dashboard: highlights the section currently on screen.
function SectionNav({ variant = 'list' }) {
  const [active, setActive] = useState('overview')
  useEffect(() => {
    const els = SECTIONS.map(([id]) => document.getElementById(id)).filter(Boolean)
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (seen[0]) setActive(seen[0].target.id)
    }, { rootMargin: '-20% 0px -65% 0px' })
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
  const go = (e, id) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }
  if (variant === 'chips') return (
    <nav aria-label="Dashboard sections" className="sticky top-16 z-30 -mx-4 overflow-x-auto border-b border-foreground/10 bg-background/90 px-4 py-2 backdrop-blur [scrollbar-width:none] lg:hidden">
      <ul className="flex gap-1.5">
        {SECTIONS.map(([id, label]) => (
          <li key={id}>
            <a href={`#${id}`} onClick={(e) => go(e, id)} aria-current={active === id ? 'true' : undefined}
              className={`relative block whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active === id ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {active === id && <motion.span layoutId="chip-active" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
  return (
    <motion.nav aria-label="Dashboard sections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="paper mt-5 rounded-md p-2">
      <p className="label-form px-2 pb-1 pt-1">Jump to</p>
      <ul>
        {SECTIONS.map(([id, label, Icon]) => (
          <li key={id}>
            <a href={`#${id}`} onClick={(e) => go(e, id)} aria-current={active === id ? 'true' : undefined}
              className={`relative flex items-center gap-2.5 rounded-[3px] px-2 py-1.5 text-sm transition-colors ${active === id ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {active === id && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-[3px] bg-accent/[0.08]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              {active === id && <motion.span layoutId="nav-bar" className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-saffron" />}
              <Icon className="relative size-4 shrink-0" aria-hidden="true" />
              <span className="relative">{label}</span>
            </a>
          </li>
        ))}
      </ul>
    </motion.nav>
  )
}

function VerifyBanner({ email }) {
  const [state, setState] = useState('idle')
  async function resend() {
    setState('sending')
    try {
      await api('/verify-email/send', { method: 'POST' })
      setState('sent')
    } catch {
      setState('error')
    }
  }
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <span className="flex items-center gap-2"><MailWarning className="size-4 shrink-0" aria-hidden="true" />Confirm <strong>{email}</strong> so you can reset your password if you forget it.</span>
      <Button size="sm" variant="outline" onClick={resend} disabled={state === 'sending' || state === 'sent'}>
        {state === 'sent' ? 'Email sent, check your inbox' : state === 'error' ? 'Try again' : 'Resend email'}
      </Button>
    </motion.div>
  )
}

export default function Admin() {
  useTitle('Dashboard')
  const [me, setMe] = useState(null)
  const [newLink, setNewLink] = useState({ title: '', url: '', type: '' })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [sheet, setSheet] = useState(false)
  const urlInput = useRef(null)
  const [adding, setAdding] = useState(false)
  const [announce, setAnnounce] = useState('')
  const navigate = useNavigate()
  const latest = useRef(null)
  latest.current = me

  const loadMe = () => api('/me').then((m) => { setSignedIn(true); setMe(m) })
  useEffect(() => {
    loadMe().catch(() => navigate('/login'))
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!me)
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-muted-foreground" role="status" aria-label="Loading" /></div>

  const profileUrl = `${location.origin}/${me.username}`
  const patchLink = (id, patch) =>
    setMe((m) => ({ ...m, links: m.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))

  const unlimited = has(me, 'unlimited_links')
  const atLimit = !unlimited && me.links.length >= FREE_LINK_LIMIT

  async function saveProfile() {
    setProfileError('')
    try {
      await api('/profile', { method: 'PUT', body: {
        display_name: me.display_name, bio: me.bio, layout: me.layout || 'classic', theme: me.theme || 'light',
        avatar_url: me.avatar_url || '', cover_url: me.cover_url || '', tags: me.tags || '',
        account_type: me.account_type || 'personal', category: me.category || '', whatsapp: me.whatsapp || '',
        occupation: me.occupation || '', location: me.location || '', bg_blur: me.bg_blur === 0 || me.bg_blur === false ? 0 : 1,
      } })
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } catch (err) {
      setProfileError(err.message)
    }
  }

  async function addLink(e) {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      const link = await api('/links', { method: 'POST', body: { title: newLink.title, url: newLink.url, type: newLink.type } })
      setMe({ ...me, links: [...me.links, link] })
      setNewLink({ title: '', url: '', type: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function saveLink(id, patch = {}) {
    const found = latest.current.links.find((x) => x.id === id)
    if (!found) return
    const l = { ...found, ...patch }
    setError('')
    try {
      await api(`/links/${id}`, { method: 'PUT', body: l })
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeLink(id) {
    if (!window.confirm('Delete this link?')) return
    await api(`/links/${id}`, { method: 'DELETE' })
    setMe({ ...me, links: me.links.filter((l) => l.id !== id) })
  }

  async function move(index, dir) {
    const links = [...latest.current.links]
    const j = index + dir
    if (j < 0 || j >= links.length) return
    ;[links[index], links[j]] = [links[j], links[index]]
    setMe({ ...latest.current, links })
    setAnnounce(`${links[j].title || 'Link'} moved to position ${j + 1} of ${links.length}`)
    await api('/links-order', { method: 'PUT', body: { ids: links.map((l) => l.id) } }).catch((e) => setError(e.message))
  }

  const persistOrder = () =>
    api('/links-order', { method: 'PUT', body: { ids: latest.current.links.map((l) => l.id) } }).catch((e) => setError(e.message))

  return (
    <BillingProvider me={me} onUnlocked={loadMe}>
    <div className="container grid gap-8 py-10 pb-40 lg:grid-cols-[1fr_300px]">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      {!me.onboarded_at && <Onboarding me={me} onDone={() => loadMe()} />}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Your links</h1>
          <Button variant="ghost" size="sm" onClick={() => logout().then(() => navigate('/'))}><LogOut /> Log out</Button>
        </div>

        <SectionNav variant="chips" />

        {me.email && !me.email_verified && <VerifyBanner email={me.email} />}

        <div id="overview" className="grid scroll-mt-24 grid-cols-2 gap-4">
          {[
            [Eye, 'Page views', me.views ?? 0, 'cobalt'],
            [MousePointerClick, 'Link clicks', me.links.reduce((n, l) => n + (l.clicks || 0), 0), 'rose'],
          ].map(([Icon, label, n, tone]) => (
            <Card key={label} accent={tone} whileHover={{ y: -3 }}>
              <CardContent className="flex items-center gap-3 p-4">
                <IconChip icon={Icon} tone={tone} />
                <div>
                  <motion.p key={n} initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-2xl font-bold tabular-nums">{n.toLocaleString()}</motion.p>
                  <p className="eyebrow mt-0.5">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {me.is_owner && (
            <Link to="/owner" className="group col-span-2 flex items-center justify-between rounded-xl border border-accent/30 bg-accent/[0.06] px-4 py-3 text-sm font-semibold text-accent transition-colors hover:bg-accent/10">
              <span className="flex items-center gap-2"><Crown className="size-4" aria-hidden="true" /> Founder dashboard: whole-site analytics</span>
              <ExternalLink className="size-4" aria-hidden="true" />
            </Link>
          )}
          <p className="col-span-2 -mt-1 text-xs text-muted-foreground">Your own visits while logged in aren't counted. To test, open your page in a private/incognito window.</p>
          <Link to="/admin/analytics" className="group col-span-2 flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-semibold transition-colors hover:bg-muted">
            <span className="flex items-center gap-2"><BarChart3 className="size-4" aria-hidden="true" /> Full analytics: countries, sources, devices</span>
            <ExternalLink className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
          {!has(me, 'analytics_90') && (
            <div id="analytics" className="col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-accent/30 bg-accent/[0.04] px-4 py-2.5 text-sm">
              <span><b>90-day analytics</b> <span className="text-muted-foreground">· free covers 30 days</span></span>
              <UnlockChip feature="analytics_90" />
            </div>
          )}
        </div>

        <Card id="share" accent="mist" className="scroll-mt-24">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Link className="break-all text-sm font-semibold text-foreground underline underline-offset-4" to={`/${me.username}`}>{profileUrl}</Link>
            <ShareButton url={profileUrl} title={me.display_name || me.username} />
          </CardContent>
        </Card>

        {has(me, 'qr_code') ? <div id="qr" className="scroll-mt-24"><QrCard url={profileUrl} username={me.username} /></div> : (
          <FeatureCard id="qr" feature="qr_code" tone="saffron" unlocked={false} icon={QrCode} title="QR code" description="A printable code that opens your page, for flyers, packaging and story posts." />
        )}


        <Card id="profile" accent="rose" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5"><IconChip icon={UserRound} tone="rose" /> Profile</CardTitle>
            <CardDescription>How your page introduces you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Public: your display name, bio, picture and topics appear on your public page, visible to anyone with the link. Don't include private information.</span></p>
            <div className="space-y-2">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" placeholder="Moyosore James" maxLength={80} value={me.display_name} onChange={(e) => setMe({ ...me, display_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Input id="bio" placeholder="Designer & creator. Sharing my work and ideas." maxLength={255} value={me.bio} onChange={(e) => setMe({ ...me, bio: e.target.value })} />
            </div>
            <AvatarPicker value={me.avatar_url || ''} name={me.display_name || me.username} onChange={(avatar_url) => setMe({ ...me, avatar_url })} />
            <AvatarPicker shape="cover" id="cover" value={me.cover_url || ''} onChange={(cover_url) => setMe({ ...me, cover_url })} />
            <AccountFields me={me} setMe={setMe} />
            <div className="space-y-2">
              <Label htmlFor="tags">Topics <span className="font-normal text-muted-foreground">(up to 4, comma-separated)</span></Label>
              <Input id="tags" placeholder="Fashion, Beauty, Lifestyle, Inspiration" maxLength={110} value={me.tags || ''} onChange={(e) => setMe({ ...me, tags: e.target.value })} />
            </div>
            <fieldset className="space-y-2">
              <legend className="label-form">Theme <span className="font-normal text-muted-foreground">(Auto follows each visitor's light or dark setting)</span></legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[['light', 'Light'], ['sage', 'Sage'], ['midnight', 'Midnight'], ['blush', 'Blush'], ['auto', 'Auto']].map(([v, label]) => (
                  <label key={v} className="cursor-pointer">
                    <input type="radio" name="theme" value={v} checked={(me.theme || 'light') === v} onChange={() => setMe({ ...me, theme: v })} className="peer sr-only" />
                    <motion.span whileTap={{ scale: 0.95 }} className="block rounded-lg border p-3 text-center text-sm font-semibold transition-colors peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--ring))]">{label}</motion.span>
                  </label>
                ))}
              </div>
            </fieldset>
            <TemplatePicker value={me.layout || 'classic'} me={me} category={me.category} accountType={me.account_type}
              onChange={(t) => setMe({ ...me, layout: t.id })} />
            <AnimatePresence initial={false}>
              {me.layout === 'backdrop' && (
                <motion.label initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="flex cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-md border border-foreground/10 bg-gradient-to-r from-rose/30 via-sand/30 to-lilac/30 px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold">Blur the background photo</span>
                    <span className="block text-xs text-muted-foreground">Uses your cover photo (or profile picture). Off shows it sharp.</span>
                  </span>
                  <input type="checkbox" className="peer sr-only" checked={me.bg_blur !== 0 && me.bg_blur !== false}
                    onChange={(e) => setMe({ ...me, bg_blur: e.target.checked ? 1 : 0 })} />
                  <span aria-hidden="true" className="relative h-6 w-11 shrink-0 rounded-full bg-foreground/20 transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-2 after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
                </motion.label>
              )}
            </AnimatePresence>
            {profileError && <p role="alert" className="text-sm font-medium text-destructive">{profileError}</p>}
            <StickySave hint="Changes show on your page after saving.">
              <Button onClick={saveProfile}>{saved ? <><Check aria-hidden="true" /> Saved</> : 'Save profile'}</Button>
            </StickySave>
            <span role="status" className="sr-only">{saved ? 'Profile saved' : ''}</span>
          </CardContent>
        </Card>

        <Card id="links" accent="lilac" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2.5"><IconChip icon={Link2} tone="lilac" /> Links</span>
              {!unlimited && <span className="text-xs font-medium text-muted-foreground">{me.links.length} of {FREE_LINK_LIMIT} free links</span>}
            </CardTitle>
            <CardDescription>Drag the handle to reorder. Changes save automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Public: every link title and URL you add is shown on your public page. Only add links you are happy for anyone to see.</span></p>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Reorder.Group axis="y" values={me.links} onReorder={(links) => setMe({ ...me, links })} className="space-y-3">
              <AnimatePresence initial={false}>
                {me.links.map((l, i) => (
                  <LinkRow key={l.id} link={l} index={i} total={me.links.length} onMove={(d) => move(i, d)}
                    onChange={(patch) => patchLink(l.id, patch)} onSave={(patch) => saveLink(l.id, patch)}
                    onRemove={() => removeLink(l.id)} onDragEnd={persistOrder} />
                ))}
              </AnimatePresence>
            </Reorder.Group>
            {me.links.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No links yet. Add your first one below.</p>}

            {!atLimit && <SocialSuggestions links={me.links} onPick={(l) => { setNewLink({ ...l, detected: true }); setTimeout(() => urlInput.current?.focus(), 0) }} />}

            {atLimit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-accent/[0.04] p-4">
                <p className="text-sm">You've used all {FREE_LINK_LIMIT} free links. <span className="text-muted-foreground">Add unlimited links:</span></p>
                <UnlockChip feature="unlimited_links" />
              </div>
            ) : (
            <form onSubmit={addLink} className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_1.4fr]">
              <Input placeholder="e.g. My latest video" aria-label="New link title" required value={newLink.title} onChange={(e) => setNewLink({ ...newLink, title: e.target.value })} />
              <Input ref={urlInput} placeholder="https://youtube.com/…" aria-label="New link URL" type="url" inputMode="url" required value={newLink.url} onChange={(e) => {
                const url = e.target.value
                const detected = detectType(url)
                setNewLink({ ...newLink, url, type: detected || (newLink.detected ? '' : newLink.type), detected: !!detected })
              }} />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <AnimatePresence mode="wait" initial={false}>
                  {newLink.detected ? (
                    <motion.p key="yes" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-2 text-sm">
                      <TypeBadge type={newLink.type} className="size-7" />
                      <span><span className="font-medium">{LINK_TYPES[newLink.type].label}</span> link detected</span>
                    </motion.p>
                  ) : (
                    <motion.div key="ask" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 flex-wrap items-center gap-2">
                      <label htmlFor="new-type" className="text-sm text-muted-foreground">Is this a social link? Choose its type:</label>
                      <div className="min-w-44 flex-1"><TypeSelect id="new-type" required value={newLink.type} onChange={(type) => setNewLink({ ...newLink, type })} /></div>
                    </motion.div>
                  )}
                </AnimatePresence>
              <Button disabled={adding} aria-busy={adding}>{adding ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} Add link</Button>
              </div>
            </form>
            )}
          </CardContent>
        </Card>

        <FeatureCard id="note" feature="founder_note" tone="sand" unlocked={has(me, 'founder_note')} icon={Feather} title="Founder's note" description="A personal letter on your page, set like paper with your signature.">
          <FounderNoteEditor me={me} setMe={setMe} />
        </FeatureCard>

        <FeatureCard id="testimonials" feature="testimonials" tone="rose" unlocked={has(me, 'testimonials')} icon={MessageSquareQuote} title="Kind words" description="Messages from happy clients, shown as chat bubbles around your page.">
          <TestimonialsEditor me={me} setMe={setMe} />
        </FeatureCard>

        <PaymentHistory />
      </div>

      <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4 [scrollbar-width:thin]">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Live preview <span className="font-normal">(click to open your page)</span></p>
          <Preview me={me} />
          <PreviewToolbar me={me} url={profileUrl} canQr={has(me, 'qr_code')} />
          <SectionNav />
        </div>
      </motion.aside>

      {/* Phones & tablets: the preview lives in a slide-up sheet. */}
      <motion.button
        type="button" onClick={() => setSheet(true)} initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.92 }}
        className="fixed bottom-5 right-5 z-40 flex [body[data-cart]_&]:bottom-44 items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl lg:hidden"
      >
        <Smartphone className="size-4" aria-hidden="true" /> Preview
      </motion.button>
      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button type="button" aria-label="Close preview" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSheet(false)} />
            <motion.div role="dialog" aria-modal="true" aria-label="Live preview"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={(_, i) => i.offset.y > 120 && setSheet(false)}
              className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-background px-4 pb-8 pt-3">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/20" aria-hidden="true" />
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Live preview</p>
                <Button variant="ghost" size="icon" onClick={() => setSheet(false)} aria-label="Close preview"><X /></Button>
              </div>
              <Preview me={me} />
              <PreviewToolbar me={me} url={profileUrl} canQr={has(me, 'qr_code')} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </BillingProvider>
  )
}
