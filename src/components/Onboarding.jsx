import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Briefcase, Check, Loader2, Sparkles, User } from 'lucide-react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import AvatarPicker from '@/components/AvatarPicker'
import { TemplatePicker } from '@/components/ProFeatures'
import { LINK_TYPES, TypeBadge } from '@/lib/linkTypes'
import { CATEGORIES, FREE_LINK_LIMIT, customCategoryText, has, isCustomCategory, makeCustomCategory } from '@/lib/plans'

// Step-by-step setup shown once after the first login. Everything is saved at the end;
// "Skip for now" just marks onboarding as done so it doesn't come back.
const SOCIALS = [
  ['instagram', 'https://instagram.com/', 'yourname'], ['tiktok', 'https://tiktok.com/@', 'yourname'],
  ['youtube', 'https://youtube.com/@', 'yourchannel'], ['x', 'https://x.com/', 'yourname'],
  ['linkedin', 'https://linkedin.com/in/', 'yourname'], ['pinterest', 'https://pinterest.com/', 'yourname'],
]
const STEPS = ['About you', 'Details', 'Profile', 'Socials', 'Template']

export default function Onboarding({ me, onDone }) {
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [d, setD] = useState({
    account_type: me.account_type || 'personal',
    category: isCustomCategory(me.category) ? 'other' : me.category || '',
    category_other: customCategoryText(me.category),
    whatsapp: me.whatsapp || '',
    occupation: me.occupation || '', location: me.location || '',
    display_name: me.display_name || me.username, bio: me.bio || '', avatar_url: me.avatar_url || '',
    layout: me.layout || 'classic',
  })
  const [handles, setHandles] = useState({})
  useEffect(() => { api('/onboarding/step', { method: 'POST', body: { step: 1 } }).catch(() => {}) }, [])
  const set = (patch) => setD((x) => ({ ...x, ...patch }))
  const business = d.account_type === 'business'
  const room = (has(me, 'unlimited_links') ? 99 : FREE_LINK_LIMIT) - me.links.length
  const chosen = SOCIALS.filter(([t]) => handles[t]?.trim())

  const categoryValue = business && d.category === 'other' ? makeCustomCategory(d.category_other) : d.category
  const canNext = [true, !business || (d.category && (d.category !== 'other' || d.category_other.trim())), d.display_name.trim(), chosen.length <= room, true][step]
  const go = (n) => {
    setDir(n > step ? 1 : -1)
    setError('')
    setStep(n)
    api('/onboarding/step', { method: 'POST', body: { step: n + 1 } }).catch(() => {}) // for the founder's drop-off funnel
  }

  async function finish(skip = false) {
    setBusy(true)
    setError('')
    try {
      if (!skip) {
        await api('/profile', { method: 'PUT', body: {
          ...d, whatsapp: business ? d.whatsapp.replace(/[^\d]/g, '') : '', category: business ? categoryValue : '',
          theme: me.theme || 'light', cover_url: me.cover_url || '', tags: me.tags || '',
        } })
        for (const [type, prefix] of chosen) {
          const h = handles[type].trim().replace(/^@/, '')
          const url = /^https?:\/\//i.test(h) ? h : prefix + h
          await api('/links', { method: 'POST', body: { title: LINK_TYPES[type].label.split(' /')[0], url, type } })
        }
      }
      await api('/onboarding/complete', { method: 'POST' })
      onDone()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div role="dialog" aria-modal="true" aria-labelledby="onb-title"
        initial={{ y: 30, scale: 0.97 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-card shadow-2xl">
        <div className="bg-gradient-to-br from-rose/50 via-card to-lilac/40 px-6 pb-4 pt-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent"><Sparkles className="size-3.5" aria-hidden="true" /> Set up your page</p>
          <h2 id="onb-title" className="mt-1 text-2xl font-bold">Step {step + 1} of {STEPS.length}: {STEPS[step]}</h2>
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {STEPS.map((s, i) => (
              <div key={s} className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                <motion.div className="h-full bg-accent" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.4 }} />
              </div>
            ))}
          </div>
        </div>

        <div className="relative min-h-[19rem] px-6 py-5">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div key={step} custom={dir}
              initial={{ opacity: 0, x: 40 * dir }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 * dir }} transition={{ duration: 0.25 }}
              className="space-y-4">
              {step === 0 && (
                <fieldset>
                  <legend className="text-sm text-muted-foreground">Who's this page for? You can change it later.</legend>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[['personal', 'Personal', 'Creator, portfolio, just me', User], ['business', 'Business', 'Shop, studio or service', Briefcase]].map(([v, label, hint, Icon]) => (
                      <label key={v} className="cursor-pointer">
                        <input type="radio" name="onb-type" value={v} checked={d.account_type === v} onChange={() => set({ account_type: v })} className="peer sr-only" />
                        <motion.span whileHover={{ y: -2 }} className="block rounded-2xl border p-4 transition-colors peer-checked:border-accent peer-checked:bg-accent/[0.06] peer-focus-visible:outline peer-focus-visible:outline-2">
                          <Icon className="size-6 text-accent" aria-hidden="true" />
                          <span className="mt-2 block font-semibold">{label}</span>
                          <span className="block text-xs text-muted-foreground">{hint}</span>
                        </motion.span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {step === 1 && (<>
                {business && (<>
                  <div className="space-y-2">
                    <Label htmlFor="onb-cat">Industry</Label>
                    <select id="onb-cat" value={d.category} onChange={(e) => set({ category: e.target.value })} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="" disabled>Choose an industry…</option>
                      {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  {d.category === 'other' && (
                    <div className="space-y-2">
                      <Label htmlFor="onb-cat-other">Other industry</Label>
                      <Input id="onb-cat-other" maxLength={60} placeholder="Laundry, photography, logistics..." value={d.category_other} onChange={(e) => set({ category_other: e.target.value })} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="onb-wa">Business WhatsApp <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <Input id="onb-wa" type="tel" inputMode="tel" placeholder="+234 801 234 5678" value={d.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Adds a "Chat on WhatsApp" button to your page. Include your country code.</p>
                  </div>
                </>)}
                <div className="space-y-2">
                  <Label htmlFor="onb-occ">{business ? 'What you do' : 'What do you do?'} <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="onb-occ" maxLength={80} placeholder={business ? 'Lash & brow studio' : 'Designer & creator'} value={d.occupation} onChange={(e) => set({ occupation: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onb-loc">Based in <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="onb-loc" maxLength={80} placeholder="Lagos, Nigeria" value={d.location} onChange={(e) => set({ location: e.target.value })} />
                </div>
              </>)}

              {step === 2 && (<>
                <div className="space-y-2">
                  <Label htmlFor="onb-name">{business ? 'Business name' : 'Display name'}</Label>
                  <Input id="onb-name" maxLength={80} value={d.display_name} onChange={(e) => set({ display_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="onb-bio">Short bio <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input id="onb-bio" maxLength={255} placeholder="One line about you" value={d.bio} onChange={(e) => set({ bio: e.target.value })} />
                </div>
                <AvatarPicker id="onb-avatar" value={d.avatar_url} name={d.display_name} onChange={(avatar_url) => set({ avatar_url })} />
              </>)}

              {step === 3 && (<>
                <p className="text-sm text-muted-foreground">Add the socials you use. Just your handle is fine.{!has(me, 'unlimited_links') && ` Free pages hold ${FREE_LINK_LIMIT} links (${Math.max(0, room)} left).`}</p>
                {SOCIALS.map(([type, prefix, ph]) => (
                  <div key={type} className="flex items-center gap-3">
                    <TypeBadge type={type} className="size-9" />
                    <div className="flex flex-1 items-center rounded-md border border-input bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                      <span className="hidden text-muted-foreground sm:inline">{prefix.replace('https://', '')}</span>
                      <input aria-label={`${LINK_TYPES[type].label} handle`} placeholder={ph} value={handles[type] || ''} onChange={(e) => setHandles({ ...handles, [type]: e.target.value })}
                        className="h-10 min-w-0 flex-1 bg-transparent px-1 outline-none" />
                    </div>
                  </div>
                ))}
                {chosen.length > room && <p role="alert" className="text-sm text-destructive">That's more than your free page holds. Remove {chosen.length - room}, or upgrade later.</p>}
              </>)}

              {step === 4 && (
                <TemplatePicker value={d.layout} me={me} category={d.category} accountType={d.account_type} onChange={(t) => set({ layout: t.id })} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {error && <p role="alert" className="px-6 text-sm font-medium text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <button type="button" onClick={() => finish(true)} disabled={busy} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Skip for now</button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => go(step - 1)} disabled={busy}><ArrowLeft /> Back</Button>}
            {step < STEPS.length - 1
              ? <Button onClick={() => go(step + 1)} disabled={!canNext}>Next <ArrowRight /></Button>
              : <Button onClick={() => finish()} disabled={busy} className="bg-accent text-accent-foreground hover:bg-accent/90">{busy ? <Loader2 className="animate-spin" /> : <Check />} Finish</Button>}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
