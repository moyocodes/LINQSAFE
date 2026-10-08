import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Crown, Lock } from 'lucide-react'
import { api, isSignedIn } from '@/api'
import { Button } from '@/components/ui/button'
import { FREE_LINK_LIMIT, naira } from '@/lib/plans'
import { fadeUp, stagger } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'

// Free plan, with the founder's current allowances (links per page, link clicks counted per month).
const freeList = (limits = {}) => [
  `Up to ${limits.links ?? FREE_LINK_LIMIT} links`, ...(limits.clicks ? [`${Number(limits.clicks).toLocaleString()} link clicks counted a month`] : []),
  'Classic, Grid and Minimal templates', 'All 5 themes incl. auto dark', 'Social badges & WhatsApp button', '30-day analytics: countries, sources, devices',
]

export default function Pricing() {
  useTitle('Pricing')
  const [cfg, setCfg] = useState(null)
  const [months, setMonths] = useState(1)
  useEffect(() => { api('/billing/config').then(setCfg).catch(() => setCfg({ enabled: false, features: [], durations: [1, 3, 6, 12] })) }, [])

  return (
    <section className="bg-hero -mt-16 pt-16">
      <div className="container py-16 md:py-24">
        <motion.div variants={stagger()} initial="hidden" animate="show" className="mx-auto max-w-xl text-center">
          <motion.h1 variants={fadeUp} className="text-4xl font-extrabold tracking-tight sm:text-5xl">Pay only for what you use</motion.h1>
          <motion.p variants={fadeUp} className="mt-3 text-muted-foreground">Start free. Add features one by one, for 1, 3, 6 or 12 months. No subscription.</motion.p>
        </motion.div>

        <motion.div variants={stagger(0.12)} initial="hidden" animate="show" className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-[1fr_1.4fr]">
          <motion.div variants={fadeUp} className="relative rounded-3xl p-7">
            <div aria-hidden="true" className="border-blend" />
            <h2 className="text-xl font-bold">Free, always</h2>
            <p className="mt-1 text-3xl font-extrabold">₦0</p>
            <ul className="mt-6 space-y-2.5 text-sm">{freeList(cfg?.limits).map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />{f}</li>)}</ul>
            <Button asChild variant="outline" className="mt-8 w-full"><Link to={isSignedIn() ? '/admin' : '/signup'}>{isSignedIn() ? 'Go to dashboard' : 'Start free'}</Link></Button>
          </motion.div>

          <motion.div variants={fadeUp} className="relative overflow-hidden rounded-3xl bg-cta p-7 text-paper shadow-xl">
            <h2 className="flex items-center gap-2 text-xl font-bold"><Crown className="size-5" aria-hidden="true" /> Add-on features</h2>
            {cfg && (
              <div role="radiogroup" aria-label="How long" className="mt-4 grid grid-cols-4 rounded-xl bg-white/10 p-1">
                {cfg.durations.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={months === m} onClick={() => setMonths(m)}
                    className={`relative rounded-lg py-1.5 text-xs font-semibold ${months === m ? 'text-foreground' : 'text-white/80 hover:text-white'}`}>
                    {months === m && <motion.span layoutId="price-dur" className="absolute inset-0 rounded-lg bg-background" />}
                    <span className="relative">{m} mo{cfg.discounts?.[m] > 0 ? ` · −${cfg.discounts[m]}%` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            <ul className="mt-5 divide-y divide-white/10 text-sm">
              {(cfg?.features || []).map((f) => (
                <li key={f.key} className="flex items-center justify-between gap-3 py-2.5">
                  <span><span className="font-semibold">{f.name}</span><span className="block text-xs text-white/70">{f.detail}</span></span>
                  <span className="shrink-0 font-semibold tabular-nums">{f.forSale ? naira(f.prices[months]) : <span className="flex items-center gap-1 text-xs font-normal text-white/70"><Lock className="size-3" aria-hidden="true" />Soon</span>}</span>
                </li>
              ))}
            </ul>
            <Button asChild className="mt-6 w-full bg-background text-foreground hover:bg-background/90">
              <Link to={isSignedIn() ? '/admin#template' : '/signup'}>{isSignedIn() ? 'Unlock features' : 'Create your page'}</Link>
            </Button>
            <p className="mt-3 text-center text-xs opacity-75">Secure payment by Paystack: card, bank transfer or USSD.</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
