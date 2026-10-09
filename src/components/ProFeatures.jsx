import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleCheck, Crown, Eye, Image, Lock, Loader2, Plus, Sparkles, Trash2, UserRound, X } from 'lucide-react'
import { api } from '@/api'
import PhoneInput from '@/components/PhoneInput'
import { useErrorToast } from '@/lib/toast'
import { ProfileView } from '@/pages/Profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, IconChip } from '@/components/ui/card'
import { LINK_TYPES, TypeBadge } from '@/lib/linkTypes'
import { CATEGORIES, TEMPLATES, categoryLabel, customCategoryText, has, isCustomCategory, makeCustomCategory, methodLabel, naira } from '@/lib/plans'

export const PaidBadge = ({ unlocked }) => (
  <span title={unlocked ? 'Unlocked' : 'Paid'} className={`inline-flex shrink-0 items-center gap-1 rounded-full p-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset sm:px-2 sm:py-0.5 ${unlocked ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-accent/10 text-accent ring-accent/20'}`}>
    {unlocked ? <Check className="size-2.5 sm:size-3" aria-hidden="true" /> : <Lock className="size-2.5 sm:size-3" aria-hidden="true" />}
    <span className="sr-only sm:not-sr-only">{unlocked ? 'Unlocked' : 'Paid'}</span>
  </span>
)

// Opens Paystack's inline popup for a checkout our server already created (so price and verification
// stay server-side). Resolves with the reference on success, null if the buyer closes it.
async function payInline(accessCode) {
  const { default: PaystackPop } = await import('@paystack/inline-js')
  return new Promise((resolve, reject) => {
    new PaystackPop().resumeTransaction(accessCode, {
      onSuccess: (t) => resolve(t.reference),
      onCancel: () => resolve(null),
      onError: (e) => reject(new Error(e?.message || 'Paystack could not open')),
    })
  })
}

// ---- Billing: a cart of paid features, shared by every place a feature appears on the dashboard ----
// Each feature shows its own price and an Add button (UnlockChip); the CartBar at the bottom sums them up,
// lets the buyer pick 1/3/6/12 months and pays for all of them in one Paystack payment.
const BillingCtx = createContext(null)
export const useBilling = () => useContext(BillingCtx)

export function BillingProvider({ me, onUnlocked, children }) {
  const [cfg, setCfg] = useState(null)
  // The cart (feature keys + months) lives only in this browser: kept across reloads, never sent to the
  // server, and gone when the person clears their cookies/site data. Features they already own drop out.
  const cartKey = `lqs-cart:${me?.username || ''}`
  const saved = (() => { try { return JSON.parse(localStorage.getItem(cartKey)) || {} } catch { return {} } })()
  const [months, setMonths] = useState(() => ([1, 3, 6, 12].includes(saved.months) ? saved.months : 1))
  const [cart, setCart] = useState(() => (Array.isArray(saved.items) ? saved.items.filter((k) => typeof k === 'string' && !has(me, k)) : []))
  useEffect(() => {
    try { cart.length ? localStorage.setItem(cartKey, JSON.stringify({ items: cart, months })) : localStorage.removeItem(cartKey) } catch { /* storage blocked */ }
  }, [cart, months, cartKey])
  useEffect(() => { if (cfg) setCart((c) => c.filter((k) => cfg.features.some((f) => f.key === k && f.forSale))) }, [cfg])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useErrorToast(error)
  const [done, setDone] = useState('')
  // "… unlocked." is a quick confirmation, not a banner that stays: gone after 2 seconds.
  useEffect(() => { if (!done) return; const t = setTimeout(() => setDone(''), 2000); return () => clearTimeout(t) }, [done])
  const [history, setHistory] = useState([])
  const loadHistory = () => api('/billing/history').then(setHistory).catch(() => {})
  useEffect(() => {
    api('/billing/config').then(setCfg).catch(() => setCfg({ enabled: false, features: [], durations: [1, 3, 6, 12] }))
    loadHistory()
  }, [])
  // Lets other fixed elements (the mobile Preview button) move up while the cart bar is showing.
  useEffect(() => {
    if (cart.length) document.body.dataset.cart = '1'
    else delete document.body.dataset.cart
    return () => { delete document.body.dataset.cart }
  }, [cart.length])

  const feature = (key) => cfg?.features.find((f) => f.key === key)
  const price = (key, m = months) => feature(key)?.prices?.[m] || 0
  const total = cart.reduce((t, k) => t + price(k), 0)
  const toggle = (key) => { setDone(''); setError(''); setCart((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key])) }

  async function pay() {
    setBusy(true)
    setError('')
    setDone('')
    let checkout
    try {
      checkout = await api('/billing/checkout', { method: 'POST', body: { items: cart.map((feature) => ({ feature, months })) } })
    } catch (e) {
      setError(e.message)
      setBusy(false)
      return
    }
    try {
      const reference = await payInline(checkout.accessCode)
      if (!reference) return // closed the popup; keep the cart
      const r = await api('/billing/verify', { method: 'POST', body: { reference } })
      setDone(`${r.name} unlocked.`)
      setCart([])
      onUnlocked?.()
      loadHistory()
    } catch (e) {
      // Popup couldn't open (blocked script, old browser): fall back to Paystack's full page.
      if (/could not open|load|network/i.test(e.message) && checkout.url) return window.location.assign(checkout.url)
      setError(`${e.message}. If you were charged, your features switch on automatically within a few minutes.`)
    } finally {
      setBusy(false)
    }
  }

  const value = { cfg, me, months, setMonths, cart, toggle, price, feature, total, pay, busy, error, done, history }
  return (
    <BillingCtx.Provider value={value}>
      {children}
      <CartBar />
    </BillingCtx.Provider>
  )
}

// Price + Add button for one feature, shown wherever that feature lives on the dashboard.
export function UnlockChip({ feature: key, label = 'Add' }) {
  const b = useBilling()
  if (!b?.cfg) return null
  const f = b.feature(key)
  const until = b.me?.features?.[key]
  const owned = !!b.me?.features && key in b.me.features
  if (owned && !until) return <PaidBadge unlocked />
  if (!b.cfg.enabled || !f?.forSale) return <span className="text-xs text-muted-foreground">{owned ? `Active until ${new Date(until).toLocaleDateString()}` : 'Coming soon'}</span>
  const added = b.cart.includes(key)
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {owned && <span className="text-xs text-emerald-800">Active until {new Date(until).toLocaleDateString()}</span>}
      <span className="text-sm font-semibold tabular-nums">{naira(b.price(key))}<span className="text-xs font-normal text-muted-foreground"> / {b.months} mo</span></span>
      <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); b.toggle(key) }}
        aria-pressed={added}
        className={`inline-flex h-8 items-center gap-1 rounded-[3px] px-3 text-xs font-semibold transition-colors ${added ? 'bg-accent text-accent-foreground' : 'border border-accent/40 text-accent hover:bg-accent/10'}`}>
        {added ? <><Check className="size-3.5" aria-hidden="true" /> Added</> : <><Plus className="size-3.5" aria-hidden="true" /> {owned ? 'Extend' : label}</>}
      </motion.button>
    </span>
  )
}

// Sticky bar with everything selected: pick the period, see the total, pay once.
function CartBar() {
  const b = useBilling()
  const show = b.cart.length > 0 || b.done || (b.error && b.cart.length > 0)
  return (
    <AnimatePresence>
      {show && (
        <motion.div role="region" aria-label="Selected features"
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="paper fixed inset-x-3 bottom-3 z-50 mx-auto max-w-2xl rounded-md p-3 shadow-2xl sm:p-4">
          {b.cart.length > 0 ? (<>
            <div className="flex flex-wrap items-center gap-3">
              <p className="min-w-0 flex-1 text-sm">
                <b>{b.cart.length} selected:</b> <span className="text-muted-foreground">{b.cart.map((k) => b.feature(k)?.name).join(', ')}</span>
              </p>
              <button type="button" onClick={() => b.cart.forEach(b.toggle)} className="text-xs text-muted-foreground underline-offset-4 hover:underline">Clear</button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div role="radiogroup" aria-label="How long" className="grid flex-1 grid-cols-4 rounded-[4px] bg-muted p-1">
                {b.cfg.durations.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={b.months === m} onClick={() => b.setMonths(m)}
                    className={`relative rounded-[3px] py-1 text-xs font-semibold ${b.months === m ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {b.months === m && <motion.span layoutId="cart-dur" className="absolute inset-0 rounded-[3px] bg-card shadow-sm" />}
                    <span className="relative">{m} mo{b.cfg.discounts?.[m] > 0 ? ` −${b.cfg.discounts[m]}%` : ''}</span>
                  </button>
                ))}
              </div>
              <Button onClick={b.pay} disabled={b.busy} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {b.busy && <Loader2 className="animate-spin" aria-hidden="true" />} Pay {naira(b.total)}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">One secure Paystack payment for everything selected. Buying more time adds to what's left.</p>
          </>) : (
            <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CircleCheck className="size-4" aria-hidden="true" />{b.done}</p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// A paid card: until the feature is unlocked, show what it does with its own price and Add button.
export function FeatureCard({ id, feature, unlocked, title, description, icon, tone = 'saffron', children }) {
  return (
    <Card id={id} accent={tone} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2.5">{icon && <IconChip icon={icon} tone={tone} />}{title} <PaidBadge unlocked={unlocked} /></CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {unlocked ? (<>
          {children}
          {feature && <div className="mt-4 flex justify-end"><UnlockChip feature={feature} /></div>}
        </>) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-accent/30 bg-accent/[0.04] p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" aria-hidden="true" /> Add it to your page for 1, 3, 6 or 12 months.</p>
            {feature && <UnlockChip feature={feature} />}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Receipts for this account.
export function PaymentHistory({ id = 'payments' }) {
  const b = useBilling()
  if (!b?.history?.length) return null
  return (
    <Card id={id} accent="saffron" className="scroll-mt-24">
      <CardHeader><CardTitle className="flex items-center gap-2.5"><IconChip icon={Crown} tone="saffron" /> Your payments</CardTitle></CardHeader>
      <CardContent>
        <ul className="divide-y text-sm">
          {b.history.map((p) => (
            <li key={p.reference} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
              <span className="font-medium">{p.name}{p.months ? ` · ${p.months} mo` : ''}</span>
              <span className="tabular-nums">{naira(p.amount)}</span>
              <span className="w-full text-xs text-muted-foreground">{p.date} · {methodLabel(p)} · Ref <code>{p.reference}</code>{p.status !== 'success' && ` · ${p.status}`}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function MiniPreview({ id }) {
  // Tiny schematic of each template so the picker shows shape, not just a name.
  const bar = 'h-1.5 rounded-full bg-foreground/20'
  const map = {
    classic: <><div className="mx-auto size-4 rounded-full bg-foreground/30" /><div className={`${bar} mt-1.5`} /><div className={`${bar} mt-1`} /><div className={`${bar} mt-1`} /></>,
    grid: <><div className="mx-auto size-4 rounded-full bg-foreground/30" /><div className="mt-1.5 grid grid-cols-2 gap-1"><div className="h-3 rounded bg-foreground/20" /><div className="h-3 rounded bg-foreground/20" /><div className="h-3 rounded bg-foreground/20" /><div className="h-3 rounded bg-foreground/20" /></div></>,
    minimal: <><div className="size-3 rounded-full bg-foreground/30" /><div className="mt-1.5 h-px bg-foreground/30" /><div className="mt-1.5 h-px bg-foreground/30" /><div className="mt-1.5 h-px bg-foreground/30" /></>,
    cover: <><div className="-mx-2 -mt-2 h-8 rounded-t bg-gradient-to-b from-rose to-accent/60" /><div className="mt-1.5 h-2 rounded bg-sand" /><div className="mt-1 h-2 rounded bg-sand" /></>,
    editorial: <div className="border border-foreground/30 p-1"><div className="mx-auto h-1.5 w-8 bg-foreground/40" /><div className="mt-1.5 h-px bg-foreground/30" /><div className="mt-1.5 h-px bg-foreground/30" /></div>,
    search: <><div className="mx-auto h-2 w-10 rounded-full bg-white shadow" /><div className="mt-2 flex justify-center gap-1"><div className="h-2.5 w-4 -rotate-6 rounded bg-white shadow" /><div className="h-2.5 w-4 rotate-6 rounded bg-white shadow" /></div></>,
    idcard: <><div className="h-6 w-8 border border-dashed border-foreground/40 p-0.5"><div className="size-full bg-foreground/30" /></div><div className="mt-1 border border-foreground/40"><div className="h-1.5 border-b border-foreground/40" /><div className="h-1.5" /></div></>,
    backdrop: <div className="flex h-full flex-col items-center justify-center gap-1"><div className="size-3 rounded-full bg-white/90" /><div className="h-2 w-12 rounded bg-white/70 backdrop-blur" /><div className="h-2 w-12 rounded bg-white/70" /></div>,
  }
  return <div aria-hidden="true" className={`h-14 overflow-hidden rounded-md p-2 ${id === 'search' ? 'bg-gradient-to-b from-rose to-lilac' : id === 'backdrop' ? 'bg-[linear-gradient(135deg,#F2A07E,#6CC3BA_55%,#2B4FAF)]' : 'bg-muted'}`}>{map[id]}</div>
}

// Phone-frame preview modal showing `children` (the page drawn in place, no loading). Template tiles
// pass a template (with Use / Add); the dashboard's floating Preview button passes `title` and `footer`.
export function TemplatePreview({ template, onClose, onUse, locked, title, footer, children }) {
  const name = title || template.name
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div className="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div role="dialog" aria-modal="true" aria-label={`${name} preview`} onClick={(e) => e.stopPropagation()}
        initial={{ y: 30, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.96 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="flex max-h-full w-full max-w-sm flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between text-white">
          <p className="font-display text-lg font-semibold !text-white">{name}</p>
          <button type="button" onClick={onClose} aria-label="Close preview" className="grid size-9 place-items-center rounded-full bg-white/15 hover:bg-white/25"><X className="size-4" /></button>
        </div>
        {/* translateZ(0) makes the frame the containing block for the page's position: fixed backgrounds. */}
        <div className="h-[min(640px,72vh)] w-full overflow-y-auto overflow-x-hidden overscroll-contain rounded-[2rem] border-[6px] border-black bg-white shadow-2xl [transform:translateZ(0)]">
          {children}
        </div>
        <div className="flex w-full flex-wrap items-center justify-center gap-2">
          {footer ?? (locked ? <UnlockChip feature={template.feature} /> : <Button onClick={onUse} className="bg-white text-black hover:bg-white/90"><Check /> Use this template</Button>)}
        </div>
      </motion.div>
    </motion.div>
  )
}

const THEMES = [
  ['light', 'Light', 'bg-white'], ['sage', 'Sage', 'bg-[#cfdcc8]'], ['midnight', 'Midnight', 'bg-[#1b2030]'],
  ['blush', 'Blush', 'bg-[#f6d9d9]'], ['auto', 'Auto', 'bg-[linear-gradient(135deg,#fff_50%,#1b2030_50%)]'],
]
const PHOTO_TAG = { cover: [Image, 'Cover photo'], profile: [UserRound, 'Profile photo'] }

// Template and theme in one picker: the theme row on top, the template tiles under it.
export function TemplatePicker({ value, onChange, onUse, theme, onTheme, me, category, accountType }) {
  const fit = accountType === 'business' ? category : 'personal'
  const [previewing, setPreviewing] = useState(null)
  return (
    <fieldset id="template" className="scroll-mt-24 space-y-3 rounded-md border border-foreground/10 p-4">
      <legend className="label-form px-1">Template &amp; theme</legend>
      <div role="radiogroup" aria-label="Theme" className="space-y-1.5">
        <p className="text-xs text-muted-foreground">Theme <span className="hidden sm:inline">(Auto follows each visitor's light or dark setting)</span></p>
        <div className="flex flex-wrap gap-2">
          {THEMES.map(([v, label, swatch]) => (
            <label key={v} className="cursor-pointer">
              <input type="radio" name="theme" value={v} checked={(theme || 'light') === v} onChange={() => onTheme(v)} className="peer sr-only" />
              <span className="flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition-colors peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[hsl(var(--ring))]">
                <span className={`size-5 rounded-full ring-1 ring-inset ring-foreground/15 ${swatch}`} aria-hidden="true" />{label}
              </span>
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Template</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TEMPLATES.map((t) => {
          const locked = !!t.feature && !has(me, t.feature)
          const recommended = t.for.includes(fit)
          return (
            <label key={t.id} className={locked ? 'cursor-default' : 'cursor-pointer'}>
              <input type="radio" name="layout" value={t.id} checked={value === t.id} disabled={locked}
                onChange={() => onChange(t)} className="peer sr-only" />
              <motion.span whileHover={locked ? {} : { y: -2 }}
                className={`relative block rounded-lg border p-2 transition-colors peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[hsl(var(--ring))] ${locked ? 'border-dashed' : ''}`}>
                <MiniPreview id={t.id} />
                <span className="mt-2 flex items-center justify-between gap-1 text-sm font-semibold">{t.name}{t.feature && <PaidBadge unlocked={!locked} />}</span>
                <span className="block text-xs text-muted-foreground">{t.hint}</span>
                {t.photo && (() => { const [Icon, text] = PHOTO_TAG[t.photo]; return (
                  <span className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.photo === 'cover' ? 'bg-cobalt/10 text-cobalt' : 'bg-rose/20 text-foreground'}`}>
                    <Icon className="size-3" aria-hidden="true" /> {text}
                  </span>
                ) })()}
                {recommended && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-accent">Suits you</span>}
                {me?.username && (
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewing(t) }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent underline-offset-4 hover:underline">
                    <Eye className="size-3.5" aria-hidden="true" /> Preview
                  </button>
                )}
                {locked && t.feature && <span className="mt-2 block border-t border-foreground/10 pt-2"><UnlockChip feature={t.feature} /></span>}
              </motion.span>
            </label>
          )
        })}
      </div>
      {TEMPLATES.some((t) => t.feature && !has(me, t.feature)) && <p className="text-xs text-muted-foreground"><b>Preview</b> any template with your own details, locked ones too; tap <b>Add</b> on locked ones, then pay for everything you picked at once.</p>}
      <AnimatePresence>
        {previewing && (
          <TemplatePreview template={previewing} locked={!!previewing.feature && !has(me, previewing.feature)}
            onClose={() => setPreviewing(null)} onUse={() => { (onUse || onChange)(previewing); setPreviewing(null) }}>
            {/* Drawn right here from your own data (locked templates too), so it opens instantly. */}
            <ProfileView data={me} layout={previewing.id} theme={theme || me.theme || 'light'} embed />
          </TemplatePreview>
        )}
      </AnimatePresence>
    </fieldset>
  )
}

export function AccountFields({ me, setMe }) {
  const business = me.account_type === 'business'
  const category = isCustomCategory(me.category) ? 'other' : me.category || ''
  const categoryOther = isCustomCategory(me.category) ? customCategoryText(me.category) : me.category_other || ''
  const setCategory = (value) => setMe({ ...me, category: value === 'other' ? makeCustomCategory(categoryOther) : value, category_other: categoryOther })
  const setCategoryOther = (value) => setMe({ ...me, category: makeCustomCategory(value), category_other: value })
  return (
    <div id="account" className="scroll-mt-24 space-y-4 rounded-md border border-foreground/10 p-4">
      <fieldset>
        <legend className="label-form">Account type</legend>
        <div className="mt-2 inline-flex rounded-lg border bg-muted p-1">
          {[['personal', 'Personal'], ['business', 'Business']].map(([v, label]) => (
            <label key={v} className="relative cursor-pointer">
              <input type="radio" name="acct" value={v} checked={(me.account_type || 'personal') === v} onChange={() => setMe({ ...me, account_type: v })} className="peer sr-only" />
              <span className="relative z-10 block rounded-md px-4 py-1.5 text-sm font-medium peer-checked:text-primary-foreground peer-focus-visible:outline peer-focus-visible:outline-2">{label}</span>
              {(me.account_type || 'personal') === v && <motion.span layoutId="acct-pill" className="absolute inset-0 rounded-md bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            </label>
          ))}
        </div>
      </fieldset>
      {business && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">Industry</Label>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="" disabled>Choose an industry…</option>
              {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {category === 'other' && (
              <Input id="category-other" maxLength={60} placeholder="Laundry, photography, logistics..." value={categoryOther} onChange={(e) => setCategoryOther(e.target.value)} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="wa">Business WhatsApp <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <PhoneInput id="wa" value={me.whatsapp || ''} onChange={(whatsapp) => setMe({ ...me, whatsapp })} describedBy="wa-hint" />
            <p id="wa-hint" className="text-xs text-muted-foreground">Adds a "Chat on WhatsApp" button to your page. Pick your country, then type the number.</p>
          </div>
        </motion.div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="occ">{business ? 'What you do' : 'Occupation'} <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="occ" maxLength={80} placeholder={business ? 'Lash & brow studio' : 'Designer & creator'} value={me.occupation || ''} onChange={(e) => setMe({ ...me, occupation: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="loc">Based in <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="loc" maxLength={80} placeholder="Lagos, Nigeria" value={me.location || ''} onChange={(e) => setMe({ ...me, location: e.target.value })} />
        </div>
      </div>
    </div>
  )
}

// Link ideas tailored to what they told us in onboarding (account type, category, occupation, topics).
// Each idea: [type, title, url prefix]. Socials they already have drop out.
const IDEA = {
  instagram: ['instagram', 'Instagram', 'https://instagram.com/'], threads: ['threads', 'Threads', 'https://threads.net/@'],
  tiktok: ['tiktok', 'TikTok', 'https://tiktok.com/@'], youtube: ['youtube', 'YouTube', 'https://youtube.com/@'],
  x: ['x', 'X', 'https://x.com/'], linkedin: ['linkedin', 'LinkedIn', 'https://linkedin.com/in/'], whatsapp: ['whatsapp', 'WhatsApp', 'https://wa.me/'],
  pinterest: ['pinterest', 'Pinterest', 'https://pinterest.com/'], snapchat: ['snapchat', 'Snapchat', 'https://snapchat.com/add/'],
  facebook: ['facebook', 'Facebook', 'https://facebook.com/'], github: ['github', 'GitHub', 'https://github.com/'],
  music: ['music', 'My music', 'https://open.spotify.com/artist/'],
  booking: ['website', 'Book an appointment', 'https://'], menu: ['store', 'Our menu', 'https://'], shop: ['store', 'Shop now', 'https://'],
  portfolio: ['website', 'My portfolio', 'https://'], site: ['website', 'Website', 'https://'], course: ['website', 'Join my course', 'https://'],
  donate: ['website', 'Donate', 'https://'], listings: ['website', 'Current listings', 'https://'], tickets: ['website', 'Get tickets', 'https://'],
  newsletter: ['website', 'Newsletter', 'https://'], map: ['website', 'Find us on Google Maps', 'https://maps.google.com/'],
  quote: ['website', 'Get a quote', 'https://'], cv: ['website', 'My CV', 'https://'],
}
const PLAN = {
  beauty: ['instagram', 'booking', 'tiktok', 'whatsapp', 'map', 'pinterest'],
  fashion: ['instagram', 'shop', 'tiktok', 'pinterest', 'whatsapp', 'threads'],
  food: ['menu', 'whatsapp', 'instagram', 'map', 'tiktok', 'facebook'],
  coaching: ['booking', 'linkedin', 'youtube', 'course', 'newsletter', 'instagram'],
  creative: ['portfolio', 'instagram', 'youtube', 'tiktok', 'music', 'pinterest'],
  health: ['booking', 'instagram', 'youtube', 'whatsapp', 'tiktok', 'course'],
  tech: ['github', 'linkedin', 'x', 'site', 'youtube', 'newsletter'],
  retail: ['shop', 'whatsapp', 'instagram', 'tiktok', 'facebook', 'map'],
  events: ['tickets', 'instagram', 'whatsapp', 'tiktok', 'map', 'facebook'],
  education: ['course', 'youtube', 'linkedin', 'whatsapp', 'newsletter', 'site'],
  finance: ['booking', 'linkedin', 'site', 'whatsapp', 'newsletter', 'x'],
  real_estate: ['listings', 'whatsapp', 'instagram', 'booking', 'youtube', 'facebook'],
  home_services: ['quote', 'whatsapp', 'map', 'facebook', 'instagram', 'site'],
  nonprofit: ['donate', 'site', 'instagram', 'facebook', 'linkedin', 'youtube'],
  travel: ['booking', 'instagram', 'tiktok', 'youtube', 'whatsapp', 'site'],
  personal: ['instagram', 'tiktok', 'threads', 'youtube', 'x', 'linkedin'],
}
// Words in occupation/topics that point to a specific link.
const HINTS = [
  [/music|sing|dj|producer|artist|rapper|band/i, 'music'], [/develop|engineer|code|software|tech/i, 'github'],
  [/design|photo|illustrat|art|creative|film|video/i, 'portfolio'], [/coach|consult|mentor|therap/i, 'booking'],
  [/write|blog|author|journal/i, 'newsletter'], [/youtube|vlog|content|creator|influenc/i, 'youtube'],
  [/job|career|recruit|professional|lawyer|account/i, 'linkedin'], [/hair|nail|lash|brow|makeup|barber|spa/i, 'booking'],
  [/chef|bak|cake|food|restaurant|cater/i, 'menu'], [/shop|store|sell|brand|boutique|fashion/i, 'shop'],
]

export function linkIdeas(me) {
  const plan = PLAN[me.account_type === 'business' ? me.category : 'personal'] || PLAN.personal
  const text = `${me.occupation || ''} ${me.tags || ''}`
  const hinted = HINTS.filter(([re]) => re.test(text)).map(([, k]) => k)
  const reason = me.account_type === 'business' ? `Popular with ${categoryLabel(me.category)}` : 'Popular with creators'
  const have = new Set(me.links.map((l) => l.type))
  const haveTitles = new Set(me.links.map((l) => l.title.toLowerCase()))
  const seen = new Set()
  return [...hinted.map((k) => [k, 'Fits what you do']), ...plan.map((k) => [k, reason]), ...Object.keys(IDEA).map((k) => [k, 'More ideas'])]
    .filter(([k]) => { if (seen.has(k)) return false; seen.add(k); return true })
    .map(([k, why]) => { const [type, title, url] = IDEA[k]; return { key: k, type, title, url, why } })
    .filter((i) => !(LINK_TYPES[i.type].hosts.length && have.has(i.type)) && !haveTitles.has(i.title.toLowerCase()))
}

// Tappable idea cards (no dropdowns): tap one and the add-link form is filled in, ready for the URL.
export function SocialSuggestions({ me, onPick }) {
  const [more, setMore] = useState(false)
  const ideas = linkIdeas(me)
  if (!ideas.length) return null
  const shown = ideas.slice(0, more ? 12 : 6)
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Suggested for you · tap one to add it</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AnimatePresence initial={false}>
          {shown.map((i) => (
            <motion.button key={i.key} type="button" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }} onClick={() => onPick({ type: i.type, title: i.title, url: i.url })}
              className="group flex min-w-0 items-center gap-2.5 rounded-xl border bg-card p-2.5 text-left shadow-sm transition-colors hover:border-accent/50 hover:bg-accent/[0.04]">
              <TypeBadge type={i.type} className="size-8 sm:size-9" />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 break-words text-sm font-semibold leading-tight sm:line-clamp-1">{i.title}</span>
                <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{i.why}</span>
              </span>
              <Plus className="hidden size-4 shrink-0 text-muted-foreground transition-transform group-hover:rotate-90 group-hover:text-accent sm:block" aria-hidden="true" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
      {ideas.length > 6 && (
        <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 text-xs font-semibold text-accent hover:underline">{more ? 'Fewer ideas' : 'More ideas'}</button>
      )}
    </div>
  )
}

// One Save button floating on the page (bottom-right, above the cart bar). Each section renders its
// own, but only the section crossing the middle of the screen shows it, so it saves what you're editing.
export function StickySave({ children, hint }) {
  const marker = useRef(null)
  const enterSave = useRef(null)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const section = marker.current?.closest('.scroll-mt-24[id]') || marker.current?.parentElement
    if (!section) return
    const io = new IntersectionObserver(([e]) => setActive(e.isIntersecting), { rootMargin: '-45% 0px -45% 0px' })
    io.observe(section)
    // Enter in a one-line field saves the section (textareas keep Enter for new lines; real forms submit themselves).
    const onKey = (e) => {
      const t = e.target
      if (e.key !== 'Enter' || e.isComposing || e.shiftKey || t.tagName !== 'INPUT' || t.closest('form')) return
      if (/^(checkbox|radio|file|button|submit|color|range)$/.test(t.type)) return
      e.preventDefault()
      enterSave.current?.querySelector('button')?.click()
    }
    section.addEventListener('keydown', onKey)
    return () => { io.disconnect(); section.removeEventListener('keydown', onKey) }
  }, [])
  return (
    <>
      <span ref={marker} hidden />
      {/* A hidden copy of the Save button for Enter, there even while the floating one is off screen. */}
      <div ref={enterSave} hidden>{children}</div>
      {createPortal(
        <AnimatePresence>
          {active && (
            <motion.div initial={{ opacity: 0, y: 16, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16, scale: 0.9 }}
              className="pointer-events-none fixed bottom-5 right-4 z-40 flex flex-col items-end gap-1.5 sm:right-6 [body[data-cart]_&]:bottom-44">
              {hint && <span className="rounded-full bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur">{hint}</span>}
              <div className="pointer-events-auto [&_button]:h-12 [&_button]:rounded-full [&_button]:px-6 [&_button]:shadow-[0_12px_30px_-8px_hsl(20_30%_15%/.5)] [&_button]:transition-transform [&_button:active]:scale-95">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

function useSaver(path, body) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  useErrorToast(error)
  async function save() {
    setState('saving')
    setError('')
    try {
      await api(path, { method: 'PUT', body: body() })
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch (e) {
      setError(e.message)
      setState('idle')
    }
  }
  const button = (
    <StickySave>
      <Button onClick={save} disabled={state === 'saving'}>
        {state === 'saving' ? <Loader2 className="animate-spin" /> : state === 'saved' ? <Check /> : null}
        {state === 'saved' ? 'Saved' : 'Save'}
      </Button>
    </StickySave>
  )
  return { button, error }
}

export function FounderNoteEditor({ me, setMe }) {
  const { button, error } = useSaver('/note', () => ({ body: me.note_body || '', sign: me.note_sign || '' }))
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="note">Your note</Label>
        <textarea id="note" rows={7} maxLength={2000} value={me.note_body || ''} onChange={(e) => setMe({ ...me, note_body: e.target.value })}
          placeholder={'I started this because…\n\nLeave a blank line between paragraphs.'}
          className="w-full rounded-md border border-input bg-background px-3 py-2 font-serif text-base" />
        <p className="text-right text-xs text-muted-foreground">{(me.note_body || '').length}/2000</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sign">Signature</Label>
        <Input id="sign" maxLength={60} placeholder="Moyosore" value={me.note_sign || ''} onChange={(e) => setMe({ ...me, note_sign: e.target.value })} />
        {me.note_sign && <p aria-hidden="true" className="font-script text-4xl text-accent">{me.note_sign}</p>}
      </div>
      {button}
    </div>
  )
}

export function TestimonialsEditor({ me, setMe }) {
  const items = me.testimonials || []
  const set = (list) => setMe({ ...me, testimonials: list })
  const { button, error } = useSaver('/testimonials', () => ({ items }))
  return (
    <div className="space-y-3">
      {items.map((t, i) => (
        <div key={i} className="flex gap-2">
          <Input aria-label={`Testimonial ${i + 1}`} maxLength={160} value={t} onChange={(e) => set(items.map((x, j) => (j === i ? e.target.value : x)))} />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove testimonial ${i + 1}`} onClick={() => set(items.filter((_, j) => j !== i))}><Trash2 /></Button>
        </div>
      ))}
      {items.length < 6 && (
        <Button type="button" variant="outline" size="sm" onClick={() => set([...items, ''])}><Plus /> Add a message from a client</Button>
      )}
      <div>{button}</div>
    </div>
  )
}
