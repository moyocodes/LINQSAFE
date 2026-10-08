import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, CircleCheck, Crown, Lock, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LINK_TYPES, TypeBadge } from '@/lib/linkTypes'
import { CATEGORIES, TEMPLATES, customCategoryText, has, isCustomCategory, makeCustomCategory, methodLabel, naira } from '@/lib/plans'

export const PaidBadge = ({ unlocked }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${unlocked ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-accent/10 text-accent ring-accent/20'}`}>
    {unlocked ? <Check className="size-3" aria-hidden="true" /> : <Lock className="size-3" aria-hidden="true" />} {unlocked ? 'Unlocked' : 'Paid'}
  </span>
)

// Jumps to the feature checklist on the dashboard, where each feature can be bought.
export function UnlockLink({ children = 'Unlock', className = '' }) {
  return (
    <Button asChild size="sm" className={`bg-accent text-accent-foreground hover:bg-accent/90 ${className}`}>
      <a href="#features"><Sparkles /> {children}</a>
    </Button>
  )
}

// Wraps a paid card: until the feature is unlocked, show what it does and a link to unlock it.
export function FeatureCard({ id, unlocked, title, description, icon: Icon, children }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{Icon && <Icon className="size-5" aria-hidden="true" />}{title} <PaidBadge unlocked={unlocked} /></CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {unlocked ? children : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-accent/[0.04] p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="size-4" aria-hidden="true" /> Locked. Unlock it for 1, 3, 6 or 12 months.</p>
            <UnlockLink />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Checklist of every paid feature: unlocked ones are ticked with their expiry; locked ones are struck
// through with a price and an Unlock button that starts Paystack checkout for the chosen period.
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

export function FeatureChecklist({ me, onUnlocked }) {
  const [cfg, setCfg] = useState(null)
  const [months, setMonths] = useState(1)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  useEffect(() => { api('/billing/config').then(setCfg).catch(() => setCfg({ enabled: false, features: [], durations: [1, 3, 6, 12] })) }, [])
  useEffect(() => { api('/billing/history').then(setHistory).catch(() => {}) }, [])

  const [done, setDone] = useState('')
  async function unlock(feature) {
    setBusy(feature)
    setError('')
    setDone('')
    let checkout
    try {
      checkout = await api('/billing/checkout', { method: 'POST', body: { feature, months } })
    } catch (e) {
      setError(e.message)
      setBusy('')
      return
    }
    try {
      const reference = await payInline(checkout.accessCode)
      if (!reference) { setBusy(''); return } // closed the popup
      const r = await api('/billing/verify', { method: 'POST', body: { reference } })
      setDone(`${r.name} unlocked${r.until ? ` until ${new Date(r.until).toLocaleDateString()}` : ''}.`)
      onUnlocked?.()
      api('/billing/history').then(setHistory).catch(() => {})
    } catch (e) {
      // Popup couldn't open (blocked script, old browser): fall back to Paystack's full page.
      if (/could not open|load|network/i.test(e.message) && checkout.url) return window.location.assign(checkout.url)
      setError(`${e.message}. If you were charged, the feature switches on automatically within a few minutes.`)
    } finally {
      setBusy('')
    }
  }
  const count = cfg ? cfg.features.filter((f) => has(me, f.key)).length : 0

  return (
    <Card id="features" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex items-center gap-2"><Crown className="size-5 text-saffron-deep" aria-hidden="true" /> Features</span>
          {cfg && <span className="text-xs font-medium text-muted-foreground">{count} of {cfg.features.length} unlocked</span>}
        </CardTitle>
        <CardDescription>Pay once for the features you want, for as long as you need them. No subscription.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!cfg ? <Loader2 className="mx-auto animate-spin text-muted-foreground" aria-label="Loading" /> : (<>
          <div role="radiogroup" aria-label="How long" className="grid grid-cols-4 rounded-xl bg-muted p-1">
            {cfg.durations.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}
                className={`relative rounded-lg py-1.5 text-xs font-semibold sm:text-sm ${months === m ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {months === m && <motion.span layoutId="dur" className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{m} {m === 1 ? 'month' : 'months'}</span>
                {cfg.discounts?.[m] > 0 && <span className="relative block text-[10px] font-medium text-accent">−{cfg.discounts[m]}%</span>}
              </button>
            ))}
          </div>

          <ul className="divide-y rounded-xl border">
            {cfg.features.map((f, i) => {
              const on = has(me, f.key)
              const until = me.features?.[f.key]
              return (
                <motion.li key={f.key} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex flex-wrap items-center gap-3 px-4 py-3">
                  {on
                    ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}><CircleCheck className="size-5 text-emerald-700" aria-hidden="true" /></motion.span>
                    : <Lock className="size-5 text-muted-foreground/70" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${on ? '' : 'text-muted-foreground line-through decoration-accent/60 decoration-2'}`}>
                      {f.name}<span className="sr-only">{on ? ' (unlocked)' : ' (locked)'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{on ? (until ? `Active until ${new Date(until).toLocaleDateString()}` : 'Active, no expiry') : f.detail}</p>
                  </div>
                  {on && !until ? null : !cfg.enabled ? (
                    <span className="text-xs text-muted-foreground">Payments coming soon</span>
                  ) : !f.forSale ? (
                    <span className="text-xs text-muted-foreground">Coming soon</span>
                  ) : (
                    <Button size="sm" variant={on ? 'outline' : 'default'} disabled={!!busy} onClick={() => unlock(f.key)}
                      className={on ? '' : 'bg-accent text-accent-foreground hover:bg-accent/90'}>
                      {busy === f.key && <Loader2 className="animate-spin" aria-hidden="true" />}
                      {on ? 'Extend' : 'Unlock'} · {naira(f.prices[months])}
                    </Button>
                  )}
                </motion.li>
              )
            })}
          </ul>
          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {done && <motion.p role="status" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-sm font-medium text-emerald-800"><CircleCheck className="size-4" aria-hidden="true" />{done}</motion.p>}
          <p className="text-xs text-muted-foreground">Secure payment by Paystack: card, bank transfer or USSD. Buying more time adds to what's left.</p>
          {history.length > 0 && (
            <details className="group rounded-md border border-foreground/10 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">Your payments ({history.length})</summary>
              <ul className="mt-3 divide-y text-sm">
                {history.map((p) => (
                  <li key={p.reference} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
                    <span className="font-medium">{p.name} · {p.months} mo</span>
                    <span className="tabular-nums">{naira(p.amount)}</span>
                    <span className="w-full text-xs text-muted-foreground">{p.date} · {methodLabel(p)} · Ref <code>{p.reference}</code>{p.status !== 'success' && ` · ${p.status}`}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>)}
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
  }
  return <div aria-hidden="true" className={`h-14 overflow-hidden rounded-md p-2 ${id === 'search' ? 'bg-gradient-to-b from-rose to-lilac' : 'bg-muted'}`}>{map[id]}</div>
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
            <label key={t.id} className={locked ? 'cursor-not-allowed' : 'cursor-pointer'}>
              <input type="radio" name="layout" value={t.id} checked={value === t.id} disabled={locked}
                onChange={() => onChange(t)} className="peer sr-only" />
              <motion.span whileHover={locked ? {} : { y: -2 }}
                className={`relative block rounded-lg border p-2 transition-colors peer-checked:border-foreground peer-checked:bg-muted peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-[hsl(var(--ring))] ${locked ? 'opacity-70' : ''}`}>
                <MiniPreview id={t.id} />
                <span className="mt-2 flex items-center justify-between gap-1 text-sm font-semibold">{t.name}{t.feature && <PaidBadge unlocked={!locked} />}</span>
                <span className="block text-xs text-muted-foreground">{t.hint}</span>
                {recommended && <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-accent">Suits you</span>}
              </motion.span>
            </label>
          )
        })}
      </div>
      {TEMPLATES.some((t) => t.feature && !has(me, t.feature)) && <p className="text-xs text-muted-foreground">Locked templates can be unlocked in <a href="#features" className="font-medium text-accent underline">Features</a>.</p>}
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
    <Button variant="secondary" onClick={save} disabled={state === 'saving'}>
      {state === 'saving' ? <Loader2 className="animate-spin" /> : state === 'saved' ? <Check /> : null}
      {state === 'saved' ? 'Saved' : 'Save'}
    </Button>
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
