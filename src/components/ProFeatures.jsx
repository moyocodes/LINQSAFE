import { createContext, useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, CircleCheck, Crown, Lock, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, IconChip } from '@/components/ui/card'
import { LINK_TYPES, TypeBadge } from '@/lib/linkTypes'
import { CATEGORIES, TEMPLATES, customCategoryText, has, isCustomCategory, makeCustomCategory, methodLabel, naira } from '@/lib/plans'

export const PaidBadge = ({ unlocked }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${unlocked ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-accent/10 text-accent ring-accent/20'}`}>
    {unlocked ? <Check className="size-3" aria-hidden="true" /> : <Lock className="size-3" aria-hidden="true" />} {unlocked ? 'Unlocked' : 'Paid'}
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
  const [months, setMonths] = useState(1)
  const [cart, setCart] = useState([]) // feature keys
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
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
            {b.error && <p role="alert" className="mt-2 text-sm font-medium text-destructive">{b.error}</p>}
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

export function TemplatePicker({ value, onChange, me, category, accountType }) {
  const fit = accountType === 'business' ? category : 'personal'
  return (
    <fieldset id="template" className="scroll-mt-24 space-y-2">
      <legend className="text-sm font-medium">Template</legend>
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
                {recommended && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-accent">Suits you</span>}
                {locked && t.feature && <span className="mt-2 block border-t border-foreground/10 pt-2"><UnlockChip feature={t.feature} /></span>}
              </motion.span>
            </label>
          )
        })}
      </div>
      {TEMPLATES.some((t) => t.feature && !has(me, t.feature)) && <p className="text-xs text-muted-foreground">Tap <b>Add</b> on any locked template, then pay for everything you picked at once.</p>}
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
        <legend className="text-sm font-medium">Account type</legend>
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
            <Input id="wa" type="tel" inputMode="tel" autoComplete="tel" placeholder="+234 801 234 5678" value={me.whatsapp ? `+${me.whatsapp}` : ''}
              onChange={(e) => setMe({ ...me, whatsapp: e.target.value.replace(/[^\d]/g, '') })} />
            <p className="text-xs text-muted-foreground">Adds a "Chat on WhatsApp" button to your page. Include your country code.</p>
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

// One-tap starters for socials the user hasn't added yet.
const SUGGEST = [
  ['instagram', 'https://instagram.com/'], ['tiktok', 'https://tiktok.com/@'], ['youtube', 'https://youtube.com/@'],
  ['x', 'https://x.com/'], ['linkedin', 'https://linkedin.com/in/'], ['whatsapp', 'https://wa.me/'],
  ['pinterest', 'https://pinterest.com/'], ['snapchat', 'https://snapchat.com/add/'], ['facebook', 'https://facebook.com/'],
]
export function SocialSuggestions({ links, onPick }) {
  const have = new Set(links.map((l) => l.type))
  const left = SUGGEST.filter(([t]) => !have.has(t)).slice(0, 6)
  if (!left.length) return null
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Suggested: add your socials</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {left.map(([t, prefix]) => (
          <motion.button key={t} type="button" whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }} onClick={() => onPick({ type: t, title: LINK_TYPES[t].label.split(' /')[0], url: prefix })}
            className="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-1 pr-3 text-xs font-medium hover:bg-muted">
            <TypeBadge type={t} className="size-6" /> <Plus className="size-3" aria-hidden="true" />{LINK_TYPES[t].label.split(' /')[0]}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// Keeps a section's Save button in view while you scroll through that section (and above the cart bar).
export function StickySave({ children, hint }) {
  return (
    <div className="sticky bottom-3 z-20 -mx-3 mt-2 flex items-center justify-end gap-3 rounded-md border border-foreground/10 bg-card/90 px-3 py-2 shadow-[0_10px_30px_-12px_hsl(20_30%_15%/.35)] backdrop-blur [body[data-cart]_&]:bottom-44">
      {hint && <span className="mr-auto text-xs text-muted-foreground">{hint}</span>}
      {children}
    </div>
  )
}

function useSaver(path, body) {
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  async function save() {
    setState('saving')
    setError('')
    try {
      await api(path, { method: 'PUT', body: body() })
      setState('saved')
      setTimeout(() => setState('idle'), 1500)
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
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
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
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <div>{button}</div>
    </div>
  )
}
