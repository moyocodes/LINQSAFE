import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { BarChart3, Briefcase, Crown, Copy, LayoutTemplate, Link2, UserRound, Share2, Smartphone, MailWarning, Feather, MessageSquareQuote, QrCode, Eye, ExternalLink, Globe, MousePointerClick, Check, ChevronDown, ChevronUp, Clock, EyeOff, GripVertical, ImagePlus, Loader2, LogOut, Plus, Trash2 } from 'lucide-react'
import { api, logout, setSignedIn } from '@/api'
import { ProfileView } from '@/pages/Profile'
import ShareButton from '@/ShareButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, IconChip } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'
import { toast, useErrorToast } from '@/lib/toast'
import AvatarPicker, { toSmallDataUrl } from '@/components/AvatarPicker'
import QrCard, { QrDialog } from '@/components/QrCard'
import { AmbientVideo } from '@/components/Media'
import Onboarding from '@/components/Onboarding'
import { AccountFields, BillingProvider, StickySave, FeatureCard, TemplatePreview, FounderNoteEditor, PaymentHistory, SocialSuggestions, TemplatePicker, TestimonialsEditor, UnlockChip } from '@/components/ProFeatures'
import { FREE_LINK_LIMIT, TEMPLATES, has } from '@/lib/plans'
import { LINK_TYPES, TypeBadge, detectType } from '@/lib/linkTypes'
import PageLoader from '@/components/PageLoader'

// What your link does: show your page (default), or send visitors straight to one of your links.
function RedirectPicker({ me, setMe }) {
  const [error, setError] = useState('')
  useErrorToast(error)
  const value = me.redirect_link_id && me.links.some((l) => l.id === me.redirect_link_id) ? String(me.redirect_link_id) : ''
  async function choose(v) {
    setError('')
    const link_id = v ? Number(v) : null
    const before = me.redirect_link_id
    setMe({ ...me, redirect_link_id: link_id })
    try { await api('/redirect', { method: 'PUT', body: { link_id } }) } catch (e) { setError(e.message); setMe((m) => ({ ...m, redirect_link_id: before })) }
  }
  return (
    <div className={`space-y-2 rounded-lg border p-3 ${value ? 'border-accent/40 bg-accent/[0.05]' : ''}`}>
      <p id="redirect-label" className="break-words text-sm font-semibold">When someone opens {location.host}/{me.username}</p>
      <div role="radiogroup" aria-labelledby="redirect-label" className="flex flex-wrap gap-2">
        {[['', 'Show my page', null], ...me.links.map((l) => [String(l.id), l.title || l.url, l])].map(([v, label, l]) => {
          const on = value === v
          return (
            <motion.button key={v || 'page'} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.95 }} onClick={() => !on && choose(v)}
              className={`flex min-w-0 max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs font-medium transition-colors ${on ? 'border-foreground bg-foreground text-background' : 'bg-card hover:border-foreground/30'}`}>
              {l ? <TypeBadge type={l.type} url={l.url} icon={l.icon_url} className="size-6" /> : <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground"><Eye className="size-3.5" aria-hidden="true" /></span>}
              <span className="truncate">{l ? `Go to ${label}` : label}</span>
            </motion.button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{value ? 'Visitors skip your page and land on that link (counted as a click). You still see your page when signed in.' : 'Or send everyone to just one link, for a launch, a sale or a new video.'}</p>
    </div>
  )
}

// The link's icon doubles as a button: tap to add or change its own logo / thumbnail; × goes back to the brand icon.
function LinkLogo({ link, onChange, onSave }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      const icon_url = await toSmallDataUrl(file, 128, 128)
      onChange({ icon_url }); onSave({ icon_url })
    } catch { toast("That picture couldn't be read. Try a JPG or PNG.", 'error') } finally { setBusy(false) }
  }
  return (
    <span className="relative">
      <button type="button" onClick={() => input.current?.click()} title={link.icon_url ? 'Change logo' : 'Add a logo or thumbnail'}
        aria-label={`${link.icon_url ? 'Change' : 'Add'} logo for ${link.title || 'link'}`} className="group relative block rounded-full">
        <TypeBadge type={link.type} url={link.url} icon={link.icon_url} className="size-8 sm:size-9" />
        <span aria-hidden="true" className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
        </span>
      </button>
      {link.icon_url && (
        <button type="button" onClick={() => { onChange({ icon_url: '' }); onSave({ icon_url: '' }) }} aria-label={`Remove logo from ${link.title || 'link'}`}
          className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-foreground text-[10px] leading-none text-background">×</button>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={pick} />
    </span>
  )
}

// Scheduled links (paid): pick when this link goes live; until then visitors don't see it.
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
const liveLabel = (iso) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
function LinkSchedule({ link, canSchedule, onChange, onSave }) {
  const [value, setValue] = useState(toLocalInput(link.live_at))
  if (!canSchedule) return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-accent/30 bg-accent/[0.04] px-3 py-2 text-xs">
      <span><b>Scheduled links</b> · pick when each link goes live</span>
      <UnlockChip feature="scheduled_links" />
    </div>
  )
  const set = (live_at) => { onChange({ live_at }); onSave({ live_at }) }
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
      <label className="text-xs font-medium" htmlFor={`live-${link.id}`}>Goes live</label>
      <input id={`live-${link.id}`} type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)}
        className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm" />
      <Button type="button" size="sm" disabled={!value} onClick={() => set(new Date(value).toISOString())}>Schedule</Button>
      {link.live_at && <Button type="button" size="sm" variant="ghost" onClick={() => { setValue(''); set(null) }}>Go live now</Button>}
    </div>
  )
}

function LinkRow({ link, index, total, onChange, onSave, onRemove, onMove, onDragEnd, canSchedule }) {
  const controls = useDragControls()
  const [scheduling, setScheduling] = useState(false)
  const upcoming = link.live_at && new Date(link.live_at) > new Date()
  return (
    <Reorder.Item
      value={link} dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className={`relative overflow-hidden rounded-lg border bg-card ${link.is_public === 0 ? 'border-dashed opacity-70' : ''}`}
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,.12)', zIndex: 10 }}
    >
      {/* Phones: handle + icon + fields on top, controls in a row underneath. Wider: controls on the right. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2 p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto]">
        <div className="flex flex-col items-center gap-2 sm:contents">
          <button
            type="button" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)}
            className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          >
            <GripVertical className="size-5" aria-hidden="true" />
          </button>
          <LinkLogo link={link} onChange={onChange} onSave={onSave} />
        </div>
        <div className="grid min-w-0 gap-2">
          <Input placeholder="Link title" aria-label={`Title for link ${index + 1}`} value={link.title} onChange={(e) => onChange({ title: e.target.value })} onBlur={() => onSave()} />
          <Input placeholder="https://instagram.com/moyosore" aria-label={`URL for link ${index + 1}`} value={link.url} onChange={(e) => onChange({ url: e.target.value })}
            onBlur={() => {
              // The type follows the URL: a known site gets its badge; anything else is a website (Shop / Music keep theirs).
              const t = detectType(link.url) || (LINK_TYPES[link.type]?.hosts.length ? 'website' : link.type || 'website')
              if (t !== link.type) { onChange({ type: t }); onSave({ type: t }) } else onSave()
            }} />
        </div>
        <div className="col-span-2 flex items-center justify-between gap-1 border-t pt-2 sm:col-span-1 sm:flex-col sm:justify-center sm:border-0 sm:pt-0">
          <Badge variant="secondary"><BarChart3 className="mr-1 size-3" aria-hidden="true" />{link.clicks}<span className="sr-only"> clicks</span></Badge>
          <div className="flex">
            <Button variant="ghost" size="icon" className={`size-9 sm:size-8 ${upcoming ? 'text-accent' : ''}`} aria-expanded={scheduling}
              aria-label={`Schedule ${link.title || 'link'}`} title={upcoming ? `Goes live ${liveLabel(link.live_at)}` : 'Schedule when this link goes live'}
              onClick={() => setScheduling((on) => !on)}>
              <Clock />
            </Button>
            {/* Public = shown on your page; hidden links stay saved here but visitors don't see them. */}
            <Button variant="ghost" size="icon" className={`size-9 sm:size-8 ${link.is_public === 0 ? 'text-muted-foreground' : 'text-emerald-700'}`}
              aria-pressed={link.is_public !== 0} aria-label={`${link.is_public === 0 ? 'Show' : 'Hide'} ${link.title || 'link'} on your page`}
              title={link.is_public === 0 ? 'Hidden from your page. Tap to show it.' : 'Shown on your page. Tap to hide it.'}
              onClick={() => { const is_public = link.is_public === 0 ? 1 : 0; onChange({ is_public }); onSave({ is_public }) }}>
              {link.is_public === 0 ? <EyeOff /> : <Eye />}
            </Button>
            <Button variant="ghost" size="icon" className="size-9 sm:size-8" aria-label={`Move ${link.title || 'link'} up`} disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp /></Button>
            <Button variant="ghost" size="icon" className="size-9 sm:size-8" aria-label={`Move ${link.title || 'link'} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown /></Button>
            <Button variant="ghost" size="icon" className="size-9 text-destructive hover:bg-destructive/10 hover:text-destructive sm:size-8" aria-label={`Delete ${link.title || 'link'}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
      {(upcoming || scheduling) && (
        <div className="space-y-2 border-t px-3 pb-3 pt-2">
          {upcoming && <p className="flex items-center gap-1.5 text-xs font-medium text-accent"><Clock className="size-3.5" aria-hidden="true" /> Goes live {liveLabel(link.live_at)} · hidden until then</p>}
          {scheduling && <LinkSchedule link={link} canSchedule={canSchedule} onChange={onChange} onSave={onSave} />}
        </div>
      )}
    </Reorder.Item>
  )
}

// Live preview: the real public page, scaled into a phone, in the template and theme picked here
// (even before saving). It reloads shortly after the saved content changes.
// Templates built around a photo, and which photo each one uses.
const PHOTO_TEMPLATES = {
  cover: { field: 'cover_url', title: 'Cover uses a big header photo', hint: 'Upload a cover photo (portrait works best). Without one it uses your profile picture.' },
  backdrop: { field: 'cover_url', title: 'Photo background fills the whole page', hint: 'Upload a cover photo for the background. Without one it uses your profile picture.' },
  search: { field: 'cover_url', title: 'Search & solve shows a photo behind the search bar', hint: 'Upload a cover photo.' },
  idcard: { field: 'avatar_url', title: 'Profile card shows your photo as a polaroid', hint: 'Upload a profile picture (a portrait crop works best).' },
  editorial: { field: 'avatar_url', title: 'Editorial shows a small round black-and-white portrait', hint: 'Upload a profile picture.' },
}

// Desktop live preview: your page drawn right here from the editor's data (no iframe, no network),
// so it updates as you type and never depends on loading the live site.
function Preview({ me }) {
  const layout = me.layout || 'classic'
  const theme = me.theme || 'light'
  return (
    <motion.div whileHover={{ y: -6, rotate: -1 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
      <Link to={`/${me.username}`} target="_blank" rel="noopener noreferrer"
        className="group relative mx-auto block h-[540px] w-[260px] overflow-hidden rounded-[2.5rem] border-[6px] border-ink bg-white shadow-xl">
        <span className="sr-only">Open your live page in a new tab</span>
        {/* Drawn at phone width (390px) and scaled down; translateZ(0) keeps fixed backgrounds inside the frame. */}
        <div aria-hidden="true" inert="" className="pointer-events-none h-[828px] w-[390px] origin-top-left overflow-hidden [transform:translateZ(0)_scale(0.6359)]">
          <ProfileView data={me} layout={layout} theme={theme} embed />
        </div>
        <motion.span key={layout + theme} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-paper backdrop-blur">
          {TEMPLATES.find((t) => t.id === layout)?.name || layout} · {theme}
        </motion.span>
        <span aria-hidden="true" className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1 rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-paper opacity-0 transition-opacity group-hover:opacity-100">
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
    setTimeout(() => setCopied(false), 2000)
  }
  const share = () => (navigator.share ? navigator.share({ title: me.display_name || me.username, url }).catch(() => {}) : copy())
  const tools = [
    { label: 'Open', icon: ExternalLink, as: 'link', to: `/${me.username}` },
    { label: copied ? 'Copied' : 'Copy', icon: copied ? Check : Copy, onClick: copy },
    { label: 'Share', icon: Share2, onClick: share },
    canQr ? { label: 'QR', icon: QrCode, onClick: () => setQr(true) } : { label: 'QR', icon: QrCode, as: 'link', to: '#qr', pro: true },
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
      <AnimatePresence>{qr && <QrDialog url={url} username={me.username} onClose={() => setQr(false)} />}</AnimatePresence>
    </motion.div>
  )
}

const SECTIONS = [
  ['overview', 'Overview', Eye], ['share', 'Share & QR', Share2], ['profile', 'Profile', UserRound], ['account', 'Account type', Briefcase],
  ['template', 'Template & theme', LayoutTemplate], ['links', 'Links', Link2],
  ['note', "Founder's note", Feather], ['testimonials', 'Kind words', MessageSquareQuote], ['you', 'Your account', UserRound], ['payments', 'Payments', Crown],
]

// Which dashboard section is on screen (desktop jump-to list).
function useActiveSection() {
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
  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActive(id)
  }
  return [active, go]
}

// Desktop jump-to menu.
function SectionNav() {
  const [active, go] = useActiveSection()
  return (
    <motion.nav aria-label="Dashboard sections" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="paper mt-5 rounded-md p-2">
      <p className="label-form px-2 pb-1 pt-1">Jump to</p>
      <SectionList active={active} onPick={go} layoutPrefix="nav" />
    </motion.nav>
  )
}

function SectionList({ active, onPick, layoutPrefix }) {
  return (
    <ul>
      {SECTIONS.map(([id, label, Icon]) => (
        <li key={id}>
          <a href={`#${id}`} onClick={(e) => { e.preventDefault(); onPick(id) }} aria-current={active === id ? 'true' : undefined}
            className={`relative flex items-center gap-2.5 rounded-[3px] px-2 py-2 text-sm transition-colors ${active === id ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {active === id && <motion.span layoutId={`${layoutPrefix}-active`} className="absolute inset-0 rounded-[3px] bg-accent/[0.08]" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
            {active === id && <motion.span layoutId={`${layoutPrefix}-bar`} className="absolute inset-y-1 left-0 w-[2px] rounded-full bg-saffron" />}
            <Icon className="relative size-4 shrink-0" aria-hidden="true" />
            <span className="relative">{label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

// Phones & tablets: a sticky, sideways-scrolling row of plain anchor links (CSS only).
function MobileSectionNav() {
  return (
    <nav aria-label="Dashboard sections" className="sticky top-16 z-30 -mx-4 border-b border-foreground/10 bg-background/90 backdrop-blur lg:hidden">
      <ul className="flex snap-x gap-2 overflow-x-auto px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map(([id, label, Icon]) => (
          <li key={id} className="shrink-0 snap-start">
            <a href={`#${id}`}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground active:bg-muted">
              <Icon className="size-3.5" aria-hidden="true" /> {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Who's signed in: picture, name, @username and email; change the username (30 / 90 day waits) and
// send yourself a password reset link.
function YouCard({ me, setMe }) {
  const [name, setName] = useState(me.username)
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  useErrorToast(error)
  const [reset, setReset] = useState('idle')
  const wait = me.next_username_change && new Date(me.next_username_change) > new Date() ? new Date(me.next_username_change) : null
  const changed = name.trim().toLowerCase() !== me.username
  async function changeUsername(e) {
    e.preventDefault()
    if (!changed) return
    if (!window.confirm(`Change your link to ${location.host}/${name.trim().toLowerCase()}? Your old link will stop working, and after this you'll have to wait before changing it again.`)) return
    setState('saving'); setError('')
    try {
      const r = await api('/username', { method: 'PUT', body: { username: name } })
      setMe({ ...me, username: r.username, next_username_change: r.next_change_at })
      setName(r.username)
      setState('saved'); setTimeout(() => setState('idle'), 2000)
    } catch (err) { setError(err.message); setState('idle') }
  }
  async function sendReset() {
    setReset('sending')
    try { await api('/password/forgot', { method: 'POST', body: { email: me.email } }); setReset('sent') } catch { setReset('error') }
  }
  return (
    <Card id="you" accent="mist" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5"><IconChip icon={UserRound} tone="mist" /> Your account</CardTitle>
        <CardDescription>Signed in as you. Only you can see this.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex min-w-0 items-center gap-3">
          {me.avatar_url
            ? <img src={me.avatar_url} alt="" className="size-14 shrink-0 rounded-full object-cover" />
            : <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-xl font-bold text-accent-foreground">{(me.display_name || me.username)[0].toUpperCase()}</span>}
          <div className="min-w-0">
            <p className="truncate font-semibold">{me.display_name || `@${me.username}`}</p>
            <Link to={`/${me.username}`} target="_blank" className="block truncate text-sm text-accent hover:underline">{location.host}/{me.username}</Link>
            <p className="break-all text-sm text-muted-foreground">{me.email || 'No email yet'}{me.email && <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${me.email_verified ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{me.email_verified ? 'Verified' : 'Not verified'}</span>}</p>
          </div>
        </div>

        <form onSubmit={changeUsername} className="space-y-2">
          <Label htmlFor="new-username">Username</Label>
          <div className="flex flex-wrap gap-2">
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-md border bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
              <span className="shrink-0 text-muted-foreground">{location.host}/</span>
              <input id="new-username" value={name} onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/gi, '').slice(0, 32))} disabled={!!wait}
                autoCapitalize="none" autoCorrect="off" spellCheck={false} aria-describedby="username-rule"
                className="h-full min-w-0 flex-1 bg-transparent pr-3 outline-none disabled:opacity-60" />
            </div>
            <Button disabled={!!wait || !changed || state === 'saving' || name.length < 3}>
              {state === 'saving' ? <Loader2 className="animate-spin" aria-hidden="true" /> : state === 'saved' ? <Check aria-hidden="true" /> : null}{state === 'saved' ? 'Changed' : 'Change'}
            </Button>
          </div>
          <p id="username-rule" className="text-xs text-muted-foreground">
            {wait ? <>You can change it again on <b>{wait.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</b>.</> : 'Your page link. After a change you wait 30 days, then 90, then 30 and so on before the next one.'}
          </p>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-4 py-3">
          <span className="text-sm"><b>Password</b> <span className="text-muted-foreground">· we'll email you a link to set a new one</span></span>
          {me.email
            ? <Button type="button" size="sm" variant="outline" onClick={sendReset} disabled={reset === 'sending' || reset === 'sent'}>
                {reset === 'sending' && <Loader2 className="animate-spin" aria-hidden="true" />}{reset === 'sent' ? 'Link sent, check your inbox' : reset === 'error' ? 'Try again' : 'Send reset link'}
              </Button>
            : <span className="text-xs text-muted-foreground">Add an email first</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function VerifyBanner({ email, onChanged }) {
  const [state, setState] = useState('idle')
  const [editing, setEditing] = useState(!email)
  const [value, setValue] = useState(email || '')
  const [error, setError] = useState('')
  useErrorToast(error)
  useEffect(() => { setEditing(!email); setValue(email || '') }, [email])
  async function resend() {
    setState('sending')
    try {
      await api('/verify-email/send', { method: 'POST' })
      setState('sent')
    } catch {
      setState('error')
    }
  }
  async function save(e) {
    e.preventDefault()
    setError(''); setState('saving')
    try {
      const r = await api('/account/email', { method: 'POST', body: { email: value } })
      setState('sent'); setEditing(false)
      onChanged?.(r)
    } catch (err) { setError(err.message); setState('idle') }
  }
  return (
    <motion.div id="email" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="status"
      className="scroll-mt-24 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      {editing ? (
        <form onSubmit={save} className="space-y-2">
          <p className="flex items-center gap-2"><MailWarning className="size-4 shrink-0" aria-hidden="true" />
            {email ? 'Change your email. We will send a verification link.' : <span><strong>Add your email.</strong> Your page goes public once you verify it, and you need it to pay and to reset your password.</span>}</p>
          <div className="flex flex-wrap gap-2">
            <Input type="email" required autoComplete="email" placeholder="you@example.com" value={value} onChange={(e) => setValue(e.target.value)}
              aria-label="Email address" aria-invalid={!!error} className="h-10 min-w-0 flex-1 bg-white text-ink" />
            <Button size="sm" className="h-10" disabled={state === 'saving'}>{state === 'saving' ? <Loader2 className="animate-spin" /> : 'Save email'}</Button>
            {email && <Button type="button" size="sm" variant="ghost" className="h-10" onClick={() => setEditing(false)}>Cancel</Button>}
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex min-w-0 items-start gap-2"><MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0">Verify <strong className="break-all">{email}</strong> to make your page public. Until then your link shows “not found”. You also need it to pay and reset your password.</span></span>
          <span className="flex gap-2">
            <Button size="sm" variant="outline" onClick={resend} disabled={state === 'sending' || state === 'sent'}>
              {state === 'sent' ? 'Email sent, check your inbox' : state === 'error' ? 'Try again' : 'Resend email'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>Change email</Button>
          </span>
        </div>
      )}
    </motion.div>
  )
}

export default function Admin() {
  useTitle('Dashboard')
  const [me, setMe] = useState(null)
  const [newLink, setNewLink] = useState({ title: '', url: '', type: '' })
  const [error, setError] = useState('')
  useErrorToast(error)
  const [saved, setSaved] = useState(false)
  const [profileError, setProfileError] = useState('')
  useErrorToast(profileError)
  const urlInput = useRef(null)
  const [adding, setAdding] = useState(false)
  const [announce, setAnnounce] = useState('')
  const [peek, setPeek] = useState(false)
  const [peekQr, setPeekQr] = useState(false)
  // Each new photo on the Photo background template suggests blurring it (text reads better on blur).
  const [blurTip, setBlurTip] = useState(false)
  const lastPhoto = useRef(null)
  const photo = me ? `${me.cover_url || ''}|${me.avatar_url || ''}` : null
  useEffect(() => {
    if (photo === null) return
    if (lastPhoto.current !== null && lastPhoto.current !== photo && me.layout === 'backdrop') setBlurTip(true)
    lastPhoto.current = photo
  }, [photo]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!peek) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [peek])
  const navigate = useNavigate()
  const latest = useRef(null)
  latest.current = me

  const loadMe = () => api('/me').then((m) => { setSignedIn(true); setMe(m) })
  useEffect(() => {
    loadMe().catch(() => navigate('/login'))
  }, [navigate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Verified the email in another tab (from the email link)? When you come back here, pick that up so the
  // "Verify your email" banner goes away. Only the email fields are refreshed, so unsaved edits stay.
  const unverified = me && me.email && !me.email_verified
  useEffect(() => {
    if (!unverified) return
    const check = () => document.visibilityState === 'visible' && api('/me')
      .then((m) => m.email_verified && setMe((cur) => ({ ...cur, email: m.email, email_verified: m.email_verified })))
      .catch(() => {})
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check) }
  }, [unverified])

  if (!me)
    return <PageLoader label="Loading your dashboard" />

  const profileUrl = `${location.origin}/${me.username}`
  const patchLink = (id, patch) =>
    setMe((m) => ({ ...m, links: m.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))

  const unlimited = has(me, 'unlimited_links')
  const freeLinks = me.limits?.links ?? FREE_LINK_LIMIT
  const atLimit = !unlimited && me.links.length >= freeLinks

  // `m` lets callers save a change they just made (e.g. "Use this template") before state catches up.
  async function saveProfile(m = me) {
    setProfileError('')
    try {
      await api('/profile', { method: 'PUT', body: {
        display_name: m.display_name, bio: m.bio, layout: m.layout || 'classic', theme: m.theme || 'light',
        avatar_url: m.avatar_url || '', cover_url: m.cover_url || '', tags: m.tags || '',
        account_type: m.account_type || 'personal', category: m.category || '', whatsapp: m.whatsapp || '',
        occupation: m.occupation || '', location: m.location || '', bg_blur: m.bg_blur === 0 || m.bg_blur === false ? 0 : 1,
      } })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setProfileError(err.message)
    }
  }

  async function addLink(e) {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      const link = await api('/links', { method: 'POST', body: { title: newLink.title, url: newLink.url, type: detectType(newLink.url) || (newLink.picked ? newLink.type : '') || 'website' } })
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
    <AmbientVideo src="/media/dashboard-loop.mp4" poster="/media/dashboard-poster.jpg" />
    <div className="container relative grid grid-cols-1 gap-8 py-10 pb-24 lg:pb-40 lg:grid-cols-[minmax(0,1fr)_300px] [&>*]:min-w-0">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      {!me.onboarded_at && <Onboarding me={me} onDone={() => loadMe()} />}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Your links</h1>
          <div className="flex min-w-0 items-center gap-1">
            {/* Who's signed in; tap for account settings. */}
            <a href="#you" className="flex min-w-0 items-center gap-2 rounded-full border bg-card/80 py-1 pl-1 pr-3 text-left hover:bg-muted" title={me.email || undefined}>
              {me.avatar_url
                ? <img src={me.avatar_url} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                : <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{(me.display_name || me.username)[0].toUpperCase()}</span>}
              <span className="min-w-0 leading-tight">
                <span className="block max-w-[10rem] truncate text-xs font-semibold">@{me.username}</span>
                <span className="block max-w-[10rem] truncate text-[11px] text-muted-foreground">{me.email || 'No email'}</span>
              </span>
            </a>
            <Button variant="ghost" size="sm" onClick={() => logout().then(() => navigate('/'))}><LogOut /> <span className="sr-only sm:not-sr-only">Log out</span></Button>
          </div>
        </div>

        <MobileSectionNav />

        {me.suspended_at && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">Your page is suspended</p>
            <p className="mt-1">Visitors see "not found" until this is lifted.{me.suspended_reason ? <> Reason: <b>{me.suspended_reason}</b>.</> : ''} If you think this is a mistake, write to <a href="mailto:support@linqsafe.com" className="underline">support@linqsafe.com</a> or use the <Link to="/contact" className="underline">contact form</Link>.</p>
          </div>
        )}
        {(!me.email || !me.email_verified) && <VerifyBanner email={me.email} onChanged={(r) => setMe({ ...me, email: r.email, email_verified: r.email_verified })} />}

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
          {me.limits?.clicks > 0 && !has(me, 'unlimited_clicks') && (() => {
            const used = me.clicks_this_month || 0, cap = me.limits.clicks, full = used >= cap
            return (
              <div className={`col-span-2 space-y-2 rounded-xl border p-3 ${full ? 'border-accent/40 bg-accent/[0.06]' : 'bg-card'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span><b className="tabular-nums">{used.toLocaleString()}</b> of {cap.toLocaleString()} link clicks counted this month</span>
                  <UnlockChip feature="unlimited_clicks" />
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={Math.min(used, cap)} aria-label="Link clicks this month">
                  <div className={`h-full rounded-full ${full ? 'bg-accent' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, (used / cap) * 100)}%` }} />
                </div>
                {full && <p className="text-xs text-muted-foreground">Your links still work for visitors. New clicks aren't counted until next month, or unlock unlimited clicks.</p>}
              </div>
            )
          })()}
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

        {has(me, 'qr_code') ? <div id="qr" className="scroll-mt-24"><QrCard url={profileUrl} username={me.username} showQr={!!me.show_qr}
          onShowQr={(on) => { setMe({ ...me, show_qr: on ? 1 : 0 }); api('/show-qr', { method: 'PUT', body: { on } }).catch((e) => { setMe((m) => ({ ...m, show_qr: on ? 0 : 1 })); toast(e.message, 'error') }) }} /></div> : (
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
            <TemplatePicker value={me.layout || 'classic'} theme={me.theme} onTheme={(theme) => setMe({ ...me, theme })} me={me} category={me.category} accountType={me.account_type}
              onChange={(t) => setMe({ ...me, layout: t.id })}
              onUse={(t) => { const next = { ...me, layout: t.id }; setMe(next); saveProfile(next) }} />
            {/* Photo templates: upload the photo they use right here (same fields as above). */}
            <AnimatePresence initial={false}>
              {PHOTO_TEMPLATES[me.layout] && (
                <motion.div key={me.layout} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden rounded-md border border-accent/25 bg-accent/[0.04] p-4">
                  <p className="text-sm font-semibold">{PHOTO_TEMPLATES[me.layout].title}</p>
                  <p className="mb-3 text-xs text-muted-foreground">{PHOTO_TEMPLATES[me.layout].hint} Then press <b>Save profile</b>.</p>
                  {PHOTO_TEMPLATES[me.layout].field === 'cover_url'
                    ? <AvatarPicker shape="cover" id="tpl-photo" value={me.cover_url || ''} onChange={(cover_url) => setMe({ ...me, cover_url })} />
                    : <AvatarPicker id="tpl-photo" value={me.avatar_url || ''} name={me.display_name || me.username} onChange={(avatar_url) => setMe({ ...me, avatar_url })} />}
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false}>
              {me.layout === 'backdrop' && blurTip && (
                <motion.div key="blur-tip" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} role="status"
                  className="flex flex-wrap items-center justify-between gap-2 overflow-hidden rounded-md border border-accent/30 bg-accent/[0.06] px-4 py-3 text-sm">
                  <span><b>New photo.</b> Blur it so your name and links stay easy to read?</span>
                  <span className="flex gap-2">
                    <Button size="sm" onClick={() => { setMe({ ...me, bg_blur: 1 }); setBlurTip(false) }}>Blur it</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setMe({ ...me, bg_blur: 0 }); setBlurTip(false) }}>Keep it sharp</Button>
                  </span>
                </motion.div>
              )}
              {me.layout === 'backdrop' && (
                <motion.label key="blur-toggle" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
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
            <StickySave hint="Changes show on your page after saving.">
              <Button onClick={() => saveProfile()}>{saved ? <><Check aria-hidden="true" /> Saved</> : 'Save profile'}</Button>
            </StickySave>
            <span role="status" className="sr-only">{saved ? 'Profile saved' : ''}</span>
          </CardContent>
        </Card>

        <Card id="links" accent="lilac" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center justify-between"><span className="flex items-center gap-2.5"><IconChip icon={Link2} tone="lilac" /> Links</span>
              {!unlimited && <span className="text-xs font-medium text-muted-foreground">{me.links.length} of {freeLinks} free links</span>}
            </CardTitle>
            <CardDescription>Drag the handle to reorder. Changes save automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RedirectPicker me={me} setMe={setMe} />
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><Globe className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span>Public: every link title and URL you add is shown on your public page. Only add links you are happy for anyone to see.</span></p>
            <Reorder.Group axis="y" values={me.links} onReorder={(links) => setMe({ ...me, links })} className="space-y-3">
              <AnimatePresence initial={false}>
                {me.links.map((l, i) => (
                  <LinkRow key={l.id} link={l} index={i} total={me.links.length} onMove={(d) => move(i, d)}
                    onChange={(patch) => patchLink(l.id, patch)} onSave={(patch) => saveLink(l.id, patch)}
                    onRemove={() => removeLink(l.id)} onDragEnd={persistOrder} canSchedule={has(me, 'scheduled_links')} />
                ))}
              </AnimatePresence>
            </Reorder.Group>
            {me.links.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No links yet. Add your first one below.</p>}

            {!atLimit && <SocialSuggestions me={me} onPick={(l) => { setNewLink({ ...l, detected: true, picked: true }); setTimeout(() => { const el = urlInput.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, 0) }} />}

            {atLimit ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-accent/[0.04] p-4">
                <p className="text-sm">You've used all {freeLinks} free links. <span className="text-muted-foreground">Add unlimited links:</span></p>
                <UnlockChip feature="unlimited_links" />
              </div>
            ) : (
            <form onSubmit={addLink} className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_1.4fr]">
              <Input placeholder="e.g. My latest video" aria-label="New link title" required value={newLink.title} onChange={(e) => setNewLink({ ...newLink, title: e.target.value })} />
              <Input ref={urlInput} placeholder="https://youtube.com/…" aria-label="New link URL" type="url" inputMode="url" required value={newLink.url} onChange={(e) => {
                const url = e.target.value
                const detected = detectType(url)
                // A picked suggestion keeps its type (e.g. "Our menu" stays a Shop link) whatever URL goes in.
                setNewLink({ ...newLink, url, type: detected || (newLink.detected && !newLink.picked ? '' : newLink.type), detected: !!detected || !!newLink.picked })
              }} />
              <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                <AnimatePresence mode="wait" initial={false}>
                  {/* No type to pick: it's worked out from the URL (a known site gets its badge, anything else is a website). */}
                  {newLink.detected && newLink.type ? (
                    <motion.p key="yes" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 items-center gap-2 text-sm">
                      <TypeBadge type={newLink.type} url={newLink.url} className="size-7" />
                      <span><span className="font-medium">{LINK_TYPES[newLink.type].label}</span>{newLink.picked ? '' : ' link detected'}</span>
                    </motion.p>
                  ) : <span className="flex-1" />}
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

        <YouCard me={me} setMe={setMe} />

        <PaymentHistory />
      </div>

      {/* Phones & tablets: floating Preview button (bottom-left, clear of Save). It opens the preview over
          the page, so closing it leaves you exactly where you were editing. */}
      <button type="button" onClick={() => setPeek(true)} aria-haspopup="dialog"
        className="fixed bottom-5 left-4 z-40 flex h-12 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-paper ring-1 ring-white/20 shadow-[0_12px_30px_-8px_hsl(20_30%_15%/.5)] transition-transform active:scale-95 lg:hidden [body[data-cart]_&]:bottom-44">
        <Smartphone className="size-4" aria-hidden="true" /> Preview
      </button>
      <AnimatePresence>
        {peek && (
          <TemplatePreview title="Your page" onClose={() => setPeek(false)}
            footer={<div className="flex w-full flex-col items-center gap-2">
              {/* Switch between the templates you can already use (free or bought); each tap saves. */}
              <div role="radiogroup" aria-label="Your templates" className="flex w-full gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
                {TEMPLATES.filter((t) => !t.feature || has(me, t.feature)).map((t) => {
                  const on = (me.layout || 'classic') === t.id
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={on}
                      onClick={() => { if (on) return; const next = { ...me, layout: t.id }; setMe(next); saveProfile(next) }}
                      className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'bg-white text-black' : 'bg-white/15 text-white hover:bg-white/25'}`}>
                      {on && <Check className="-ml-0.5 mr-1 inline size-3" aria-hidden="true" />}{t.name}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <a href={profileUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-white/90"><ExternalLink className="size-4" aria-hidden="true" /> Open my page</a>
                {has(me, 'qr_code') && <button type="button" onClick={() => setPeekQr(true)}
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"><QrCode className="size-4" aria-hidden="true" /> View QR</button>}
              </div>
            </div>}>
            <ProfileView data={me} layout={me.layout || 'classic'} theme={me.theme || 'light'} embed />
          </TemplatePreview>
        )}
      </AnimatePresence>
      <AnimatePresence>{peekQr && <QrDialog url={profileUrl} username={me.username} onClose={() => setPeekQr(false)} />}</AnimatePresence>

      {/* Desktop only: sticky preview column. */}
      <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-4 [scrollbar-width:thin]">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Live preview <span className="font-normal">(click to open your page)</span></p>
          <Preview me={me} />
          <PreviewToolbar me={me} url={profileUrl} canQr={has(me, 'qr_code')} />
          <SectionNav />
        </div>
      </motion.aside>

    </div>
    </BillingProvider>
  )
}
