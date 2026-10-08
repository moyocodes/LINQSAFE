import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Banknote, CreditCard, Check, Crown, Eye, Link2, Loader2, Mail, MousePointerClick, ShieldCheck, Store, Tag, UserPlus, Users } from 'lucide-react'
import { api } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarList, Kpi, LineChart, flag, fmtDay, regionName } from '@/pages/Analytics'
import { CATEGORIES, TEMPLATES, categoryLabel, channelName, methodLabel, naira } from '@/lib/plans'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTitle } from '@/lib/useTitle'
import { InfoTip } from '@/components/ui/info-tip'
import OwnerTraffic from '@/components/OwnerTraffic'
import PageLoader from '@/components/PageLoader'
import OwnerShell, { ownerBase } from '@/components/OwnerShell'

const SIGNUPS = '#2a78d6'
const tplName = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.name]))

function SignupBars({ series }) {
  const max = Math.max(1, ...series.map((s) => s.signups))
  return (
    <div className="flex h-36 items-end gap-[2px]" role="img" aria-label="Signups per day">
      {series.map((s, i) => (
        <div key={s.date} className="group relative flex h-full flex-1 items-end" title={`${fmtDay(s.date)}: ${s.signups}`}>
          <motion.div className="w-full rounded-t-[4px]" style={{ background: SIGNUPS }}
            initial={{ height: 0 }} animate={{ height: `${(s.signups / max) * 100}%` }} transition={{ delay: i * 0.01, duration: 0.5 }} />
          <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-1.5 py-0.5 text-[10px] text-background group-hover:block">
            {fmtDay(s.date)} · {s.signups}
          </span>
        </div>
      ))}
    </div>
  )
}

// Founder-editable prices: monthly price per feature + discounts for longer periods.
function PricingEditor() {
  const [cfg, setCfg] = useState(null)
  const [prices, setPrices] = useState({})
  const [discounts, setDiscounts] = useState({})
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const load = (c) => {
    setCfg(c)
    setPrices(Object.fromEntries(c.features.map((f) => [f.key, f.monthly || ''])))
    setDiscounts({ ...c.discounts })
  }
  useEffect(() => { api('/owner/pricing').then(load).catch((e) => setError(e.message)) }, [])
  async function save() {
    setState('saving')
    setError('')
    try {
      const body = {
        prices: Object.fromEntries(Object.entries(prices).map(([k, v]) => [k, Number(v) || 0])),
        discounts: Object.fromEntries(Object.entries(discounts).map(([k, v]) => [k, Number(v) || 0])),
      }
      load(await api('/owner/pricing', { method: 'PUT', body }))
      setState('saved')
      setTimeout(() => setState('idle'), 2000)
    } catch (e) {
      setError(e.message)
      setState('idle')
    }
  }
  if (!cfg) return error ? <p className="text-sm text-destructive">{error}</p> : null
  const preview = (key, m) => {
    const base = (Number(prices[key]) || 0) * m * (1 - (m === 1 ? 0 : Number(discounts[m]) || 0) / 100)
    return base > 0 ? naira(Math.round(base / 50) * 50) : '–'
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Tag className="size-5" aria-hidden="true" /> Pricing</CardTitle>
        <CardDescription>Monthly price per feature in naira. 0 or empty keeps a feature off sale. Changes apply to new checkouts immediately.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="py-1.5 font-medium">Feature</th><th className="font-medium">Per month (₦)</th>
                {cfg.durations.map((m) => <th key={m} className="text-right font-medium">{m} mo</th>)}</tr>
            </thead>
            <tbody>
              {cfg.features.map((f) => (
                <tr key={f.key} className="border-t">
                  <td className="py-2 pr-3 font-medium">{f.name}</td>
                  <td className="pr-3"><Input type="number" min="0" step="50" inputMode="numeric" aria-label={`${f.name} monthly price`} className="h-9 w-28"
                    value={prices[f.key]} onChange={(e) => setPrices({ ...prices, [f.key]: e.target.value })} /></td>
                  {cfg.durations.map((m) => <td key={m} className="text-right tabular-nums text-muted-foreground">{preview(f.key, m)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <fieldset className="flex flex-wrap items-end gap-4">
          <legend className="mb-2 text-sm font-medium">Discount for longer periods (%)</legend>
          {[3, 6, 12].map((m) => (
            <label key={m} className="text-xs text-muted-foreground">{m} months
              <Input type="number" min="0" max="90" inputMode="numeric" className="mt-1 h-9 w-20" value={discounts[m] ?? ''} onChange={(e) => setDiscounts({ ...discounts, [m]: e.target.value })} />
            </label>
          ))}
          <Button onClick={save} disabled={state === 'saving'} className="ml-auto">
            {state === 'saving' ? <Loader2 className="animate-spin" /> : state === 'saved' ? <Check /> : null}{state === 'saved' ? 'Saved' : 'Save prices'}
          </Button>
        </fieldset>
        {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}

const STEP_NAMES = ['About you', 'Details', 'Profile', 'Socials', 'Template']

// Each stage as a share of everyone who signed up, with the drop from the previous stage.
function Funnel({ stages }) {
  const top = stages[0]?.n || 0
  return (
    <ol className="space-y-2.5">
      {stages.map((s, i) => {
        const share = top ? s.n / top : 0
        const prev = i ? stages[i - 1].n : null
        const drop = prev ? 1 - s.n / prev : 0
        return (
          <li key={s.label}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span><span className="mr-2 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>{s.label}</span>
              <span className="tabular-nums"><b>{s.n}</b> <span className="text-muted-foreground">({Math.round(share * 100)}%)</span>
                {i > 0 && prev > 0 && drop > 0 && <span className="ml-2 text-xs text-accent">−{Math.round(drop * 100)}%</span>}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-[3px] bg-foreground/5">
              <motion.div className="h-full rounded-[3px]" style={{ background: '#2a78d6' }} initial={{ width: 0 }} animate={{ width: `${share * 100}%` }} transition={{ delay: i * 0.08, duration: 0.6 }} />
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function RevenueByMonth({ months }) {
  const max = Math.max(1, ...months.map((m) => m.amount))
  if (!months.length) return <p className="py-6 text-center text-sm text-muted-foreground">No revenue yet.</p>
  return (
    <div className="flex h-40 items-end gap-2">
      {months.map((m, i) => (
        <div key={m.month} className="group flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${m.month}: ${naira(m.amount)}`}>
          <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">{naira(m.amount)}</span>
          <motion.div className="w-full rounded-t-[4px]" style={{ background: '#2a78d6' }} initial={{ height: 0 }} animate={{ height: `${(m.amount / max) * 100}%` }} transition={{ delay: i * 0.05 }} />
          <span className="text-[10px] text-muted-foreground">{new Date(`${m.month}-01T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })}</span>
        </div>
      ))}
    </div>
  )
}

export default function Owner() {
  useTitle('Founder dashboard')
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [d, setD] = useState(null)
  const [denied, setDenied] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    setD(null)
    let robots = document.querySelector('meta[name="robots"]')
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots) }
    robots.content = 'noindex, nofollow'
    api(`/owner/stats?days=${days}`).then(setD).catch((e) => (e.message === 'Not authenticated' ? navigate('/login') : setDenied(true)))
  }, [days, navigate, reload])

  if (denied) return (
    <div className="container grid min-h-[50vh] place-items-center text-center">
      <div><ShieldCheck className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h1 className="mt-3 text-2xl font-bold">Owner only</h1>
        <p className="mt-1 text-muted-foreground">This dashboard is limited to the site owner's verified email.</p></div>
    </div>
  )

  const range = (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-lg border bg-card p-1">
      {[7, 30, 90].map((n) => (
        <button key={n} role="radio" aria-checked={days === n} onClick={() => setDays(n)}
          className={`relative rounded-md px-2.5 py-1 text-sm font-medium ${days === n ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          {days === n && <motion.span layoutId="owner-range" className="absolute inset-0 rounded-md bg-primary" />}
          <span className="relative">{n}d</span>
        </button>
      ))}
    </div>
  )

  return (
    <OwnerShell title={<span className="flex items-center gap-2"><Crown className="size-5 text-accent" aria-hidden="true" /> Founder dashboard</span>} tools={range} onRefresh={() => setReload((r) => r + 1)}>
      {!d ? <PageLoader label="Loading numbers" className="h-64" /> : (<>
        <div id="overview" className="grid scroll-mt-24 grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Users} label="Total users" info="Every account ever created, verified or not." value={d.totals.users.toLocaleString()} />
          <Kpi icon={UserPlus} label={`New in ${days} days`} info="Accounts created in the selected range (today counts as day 1)." value={d.totals.newUsers.toLocaleString()} />
          <Kpi icon={Crown} label="Paying users" info="Users with at least one paid feature active right now (not expired). The % is out of all users." value={`${d.totals.pro} (${d.totals.users ? Math.round((d.totals.pro / d.totals.users) * 100) : 0}%)`} />
          <Kpi icon={Store} label="Business accounts" info="Accounts set to Business during onboarding or in Account type." value={d.totals.business.toLocaleString()} />
          <Kpi icon={Eye} label="Page views" info="Profile page loads in the range, across all pages. Your own visits while signed in, bots, and refreshes within 30 minutes aren't counted." value={d.totals.views.toLocaleString()} />
          <Kpi icon={Users} label="Unique visitors" info="Distinct visitors per day, counted without cookies." value={d.totals.visitors.toLocaleString()} />
          <Kpi icon={MousePointerClick} label="Link clicks" info="Taps on links (and social icons) on profile pages in the range." value={d.totals.clicks.toLocaleString()} />
          <Kpi icon={Link2} label="Links created" info="All links on all pages right now." value={d.totals.links.toLocaleString()} />
          <Kpi icon={Banknote} label={`Revenue, ${days} days`} info="Sum of successful Paystack payments in the range. Started or failed payments are left out." value={naira(d.totals.revenue || 0)} />
        </div>

        <div id="growth" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Activation funnel <InfoTip>Of the people who signed up in the range: how many finished onboarding, added a bio or photo, added a first link, got a first visitor, and paid. Each % is out of signups.</InfoTip></CardTitle><CardDescription>People who signed up in the last {days} days, and how far they got.</CardDescription></CardHeader>
            <CardContent>
              <Funnel stages={[
                { label: 'Signed up', n: d.funnel.signed_up }, { label: 'Finished onboarding', n: d.funnel.onboarded },
                { label: 'Added bio or photo', n: d.funnel.profile }, { label: 'Added a first link', n: d.funnel.first_link },
                { label: 'Got a first visitor', n: d.funnel.first_visit }, { label: 'Paid for a feature', n: d.funnel.paid },
              ]} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Onboarding drop-off <InfoTip>Furthest onboarding screen each new signup reached (saved as they go). A big drop between two steps shows where people quit.</InfoTip></CardTitle><CardDescription>Furthest setup step reached by new signups. Big drops show where people quit.</CardDescription></CardHeader>
            <CardContent>
              {/* onboarding_step = furthest screen reached (1 = About you … 5 = Template). */}
              <Funnel stages={[
                { label: 'Signed up', n: d.funnel.signed_up },
                ...STEP_NAMES.map((label, i) => ({ label: `Reached: ${label}`, n: d.onboardingSteps.filter((x) => x.step >= i + 1).reduce((a, x) => a + x.n, 0) })),
                { label: 'Finished setup', n: d.funnel.onboarded },
              ]} />
            </CardContent>
          </Card>
        </div>

        <div id="revenue" className="grid scroll-mt-24 grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={Banknote} label="Monthly run-rate" info="For every purchase still running today: its price ÷ its months, added up. ₦3,000 for 3 months adds ₦1,000." value={naira(Math.round(d.money.runRate))} />
          <Kpi icon={Banknote} label="Yearly equivalent" info="Monthly run-rate × 12." value={naira(Math.round(d.money.arr))} />
          <Kpi icon={Crown} label="Revenue per paying user" info="Lifetime revenue ÷ the number of users who have ever paid." value={naira(Math.round(d.money.arppu))} />
          <Kpi icon={Users} label="Free → paid" info="Share of all users who have ever made a successful payment (the count is in brackets)." value={`${d.totals.users ? Math.round((d.money.payers / d.totals.users) * 100) : 0}% (${d.money.payers})`} />
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">Run-rate spreads each purchase over its months (₦3,000 for 3 months counts ₦1,000 a month) for purchases still running today. There are no subscriptions, so it's the nearest thing to MRR.</p>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2">Revenue by month <InfoTip>Successful payments grouped by the month they were paid, last 12 months.</InfoTip></CardTitle><CardDescription>Last 12 months · lifetime {naira(d.money.lifetime)}</CardDescription></CardHeader>
            <CardContent><RevenueByMonth months={d.money.byMonth} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Revenue by feature <InfoTip>Successful payments in the range, split by feature. A multi-feature payment is split by each feature's price.</InfoTip></CardTitle><CardDescription>Last {days} days</CardDescription></CardHeader>
            <CardContent><BarList empty="No revenue yet." rows={d.money.byFeature.map((f) => ({ key: f.name, label: f.name, n: f.n, display: naira(f.n) }))} /></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Expiry & renewals <InfoTip>Expiring: active features ending in the next 7 days. Expired: ended in the last 30 days. Renewed: users who bought the same feature more than once.</InfoTip></CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['Expiring in 7 days', d.expiry.soon], ['Expired, last 30 days', d.expiry.expired], ['Renewed', d.expiry.renewed]].map(([l, n]) => (
                  <div key={l} className="rounded-md bg-muted/60 p-2"><p className="text-xl font-bold tabular-nums">{n}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>
                ))}
              </div>
              {d.expiry.list.length > 0 && (
                <ul className="divide-y text-sm">{d.expiry.list.map((e) => (
                  <li key={e.username + e.feature} className="flex justify-between py-1.5"><Link to={`/${e.username}`} className="hover:underline">{e.username}</Link><span className="text-muted-foreground">{e.name} · {e.until}</span></li>
                ))}</ul>
              )}
            </CardContent>
          </Card>
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="flex items-center gap-2">Paid features in use <InfoTip>Features active right now, counted per user.</InfoTip></CardTitle><CardDescription>Active right now, across all users.</CardDescription></CardHeader>
            <CardContent><BarList empty="No paid features active yet." rows={d.featureUse.map((f) => ({ key: f.name, label: f.name, n: f.n }))} /></CardContent>
          </Card>
        </div>

        <div id="traffic" className="scroll-mt-24"><OwnerTraffic /></div>

        <div id="pricing" className="scroll-mt-24"><PricingEditor /></div>

        <div id="payments" className="grid scroll-mt-24 gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CreditCard className="size-5" aria-hidden="true" /> Payments</CardTitle>
              <CardDescription>Latest 30, newest first. LinqSafe ref is the reference we create and send to Paystack.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {d.payments.length ? (
                <table className="w-full min-w-[46rem] text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-1.5 font-medium">Date</th><th className="font-medium">User</th><th className="font-medium">Feature</th><th className="text-right font-medium">Amount</th><th className="pl-4 font-medium">Paid with</th><th className="font-medium">LinqSafe ref</th><th className="font-medium">Paystack ID</th><th className="font-medium">Status</th></tr>
                  </thead>
                  <tbody>
                    {d.payments.map((p) => (
                      <tr key={p.reference} className="border-t align-top">
                        <td className="whitespace-nowrap py-2 tabular-nums text-muted-foreground">{p.date}</td>
                        <td><Link to={`/${p.username}`} className="font-medium hover:underline">{p.username}</Link><span className="block text-xs text-muted-foreground">{p.customer_email}</span></td>
                        <td>{p.name}<span className="block text-xs text-muted-foreground">{p.months} mo</span></td>
                        <td className="text-right tabular-nums">{naira(p.amount)}</td>
                        <td className="pl-4">{methodLabel(p)}</td>
                        <td><code className="text-xs">{p.reference}</code></td>
                        <td className="tabular-nums text-xs">{p.paystack_id || '–'}</td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'success' ? 'bg-emerald-50 text-emerald-800' : p.status === 'initialized' ? 'bg-muted text-muted-foreground' : 'bg-red-50 text-red-800'}`}
                            title={p.gateway_response || undefined}>{p.status === 'initialized' ? 'started' : p.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">How people pay <InfoTip>Successful payments in the range by Paystack channel (card, bank transfer, USSD…).</InfoTip></CardTitle><CardDescription>Successful payments, last {days} days.</CardDescription></CardHeader>
            <CardContent><BarList empty="No payments yet." rows={d.methods.map((m) => ({ key: m.name || 'x', label: channelName(m.name), n: m.n }))} /></CardContent>
          </Card>
        </div>

        <div id="signups" className="grid scroll-mt-24 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Signups per day <InfoTip>New accounts per day in the range.</InfoTip></CardTitle><CardDescription>{d.totals.verified} of {d.totals.users} users have verified their email.</CardDescription></CardHeader>
            <CardContent><SignupBars series={d.series} /></CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2">Business categories <InfoTip>Business accounts by the category they picked.</InfoTip></CardTitle></CardHeader>
            <CardContent><BarList empty="No business accounts yet." rows={d.categories.map((c) => ({ key: c.name, label: categoryLabel(c.name), n: c.n }))} /></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2">Templates in use <InfoTip>Every page's current template.</InfoTip></CardTitle></CardHeader>
            <CardContent><BarList rows={d.templates.map((t) => ({ key: t.name, label: tplName[t.name] || t.name, n: t.n }))} /></CardContent></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center justify-between gap-2">Latest signups <Link to={`${ownerBase}/users`} className="text-sm font-medium text-accent hover:underline">All users →</Link></CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground"><tr><th className="py-1.5 font-medium">User</th><th className="font-medium">Type</th><th className="font-medium">Paid features</th><th className="font-medium">Joined</th><th className="font-medium">Last login</th></tr></thead>
                <tbody>{d.recent.map((u) => (
                  <tr key={u.username} className="border-t">
                    <td className="py-1.5"><Link to={`/${u.username}`} className="font-medium hover:underline">{u.username}</Link>{!u.email_verified && <span className="ml-1 text-xs text-muted-foreground">(unverified)</span>}</td>
                    <td>{u.account_type === 'business' ? categoryLabel(u.category) || 'Business' : 'Personal'}</td>
                    <td>{u.plan === 'pro' ? <span className="font-semibold text-accent">All (manual)</span> : u.paid_features ? <span className="font-semibold text-accent">{u.paid_features}</span> : 'None'}</td>
                    <td className="tabular-nums text-muted-foreground">{u.joined}</td>
                    <td className="tabular-nums text-muted-foreground">{u.last_login || '–'}{!u.onboarded && <span className="ml-1 text-xs">(not onboarded)</span>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </CardContent>
          </Card>
          <Card id="messages" className="scroll-mt-24">
            <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="size-5" aria-hidden="true" /> Contact messages</CardTitle></CardHeader>
            <CardContent>
              {d.messages.length ? (
                <ul className="space-y-3">{d.messages.map((m, i) => (
                  <li key={i} className="border-b pb-3 text-sm last:border-0">
                    <p className="font-medium">{m.name} <a href={`mailto:${m.email}`} className="font-normal text-muted-foreground hover:underline">{m.email}</a> <span className="float-right text-xs text-muted-foreground">{m.sent}</span></p>
                    <p className="mt-0.5 text-muted-foreground">{m.message}</p>
                  </li>
                ))}</ul>
              ) : <p className="py-6 text-center text-sm text-muted-foreground">No messages yet.</p>}
            </CardContent>
          </Card>
        </div>
      </>)}
    </OwnerShell>
  )
}
