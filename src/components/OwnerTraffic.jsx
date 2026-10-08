import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CalendarClock, Download, Eye, FileText, Filter, Globe2, LayoutTemplate, Loader2, MousePointerClick, Percent, QrCode, Repeat, Search, Smartphone, Users, X } from 'lucide-react'
import { api } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BarList, BestTime, CLICKS, Kpi, LineChart, NewVsReturning, VIEWS, WeekSummary, flag, pct, regionName, sourceName } from '@/pages/Analytics'
import { CATEGORIES, TEMPLATES, categoryLabel } from '@/lib/plans'
import { TypeBadge } from '@/lib/linkTypes'
import { InfoTip } from '@/components/ui/info-tip'

const tplName = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.name]))
// Every filter the founder traffic view understands; they live in the URL so a view can be bookmarked or shared.
const KEYS = ['days', 'account', 'category', 'template', 'paid', 'country', 'device', 'source', 'user']
const field = 'h-9 rounded-md border bg-card px-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function Select({ label, value, onChange, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="label-form text-[10px]">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={field}>{children}</select>
    </label>
  )
}

export default function OwnerTraffic() {
  const [params, setParams] = useSearchParams()
  const filters = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']))
  const days = Number(filters.days) || 30
  const query = useMemo(() => {
    const q = new URLSearchParams()
    for (const k of KEYS) if (filters[k]) q.set(k, filters[k])
    if (!q.has('days')) q.set('days', '30')
    return q.toString()
  }, [params]) // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [user, setUser] = useState(filters.user)
  useEffect(() => setUser(filters.user), [filters.user])

  useEffect(() => {
    let live = true
    setData(null); setError('')
    api(`/owner/traffic?${query}`).then((d) => live && setData(d)).catch((e) => live && setError(e.message))
    return () => { live = false }
  }, [query])

  const set = (k, v) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }
  const active = KEYS.filter((k) => k !== 'days' && filters[k])
  const clear = () => {
    const next = new URLSearchParams(params)
    for (const k of active) next.delete(k)
    setParams(next, { replace: true })
  }
  const ctr = data?.views ? pct(data.clicks / data.views) : '–'
  const opts = data?.options
  const exportUrl = (what) => `/api/owner/export/${what}.csv?${query}`

  return (
    <section className="space-y-6" aria-labelledby="traffic-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow flex items-center gap-1.5">Traffic <InfoTip>Your own visits while signed in, bots, and refreshes within 30 minutes aren't counted. Filters on account, category, template and plan look at the page owner; country, device and source look at the visit.</InfoTip></p>
          <h2 id="traffic-title" className="font-display text-2xl font-semibold tracking-tight">Every page, every visit</h2>
          <p className="text-sm text-muted-foreground">The same analytics users see for their page, across the whole site. Filter by anything below.</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Export CSV">
          {[['events', 'Visits & clicks', FileText], ['pages', 'Pages', LayoutTemplate], ['users', 'Users', Users], ['payments', 'Payments', Download]].map(([w, label, Icon]) => (
            <a key={w} href={exportUrl(w)} download
              className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-2 text-xs font-medium hover:bg-muted">
              <Icon className="size-3.5" aria-hidden="true" /> {label} <span className="text-muted-foreground">CSV</span>
            </a>
          ))}
        </div>
      </div>

      <Card accent>
        <CardContent className="pt-6">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Filter className="size-4 text-accent" aria-hidden="true" /> Filters
            {active.length > 0 && (
              <button onClick={clear} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="size-3.5" aria-hidden="true" /> Clear {active.length}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Select label="Date range" value={String(days)} onChange={(v) => set('days', v === '30' ? '' : v)}>
              {(opts?.days || [7, 30, 90, 180, 365]).map((d) => <option key={d} value={d}>Last {d} days</option>)}
            </Select>
            <Select label="Account" value={filters.account} onChange={(v) => set('account', v)}>
              <option value="">Everyone</option><option value="personal">Personal</option><option value="business">Business</option>
            </Select>
            <Select label="Business category" value={filters.category} onChange={(v) => set('category', v)}>
              <option value="">Any</option>
              {CATEGORIES.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              {opts?.categories.filter((c) => !CATEGORIES.some(([id]) => id === c)).map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Template" value={filters.template} onChange={(v) => set('template', v)}>
              <option value="">Any</option>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select label="Plan" value={filters.paid} onChange={(v) => set('paid', v)}>
              <option value="">Free and paid</option><option value="paid">Has a paid feature</option><option value="free">Free only</option>
            </Select>
            <Select label="Visitor country" value={filters.country} onChange={(v) => set('country', v)}>
              <option value="">Anywhere</option>
              {opts?.countries.map((c) => <option key={c} value={c}>{flag(c)} {regionName(c)}</option>)}
              <option value="unknown">Unknown</option>
            </Select>
            <Select label="Device" value={filters.device} onChange={(v) => set('device', v)}>
              <option value="">Any</option><option value="mobile">Mobile</option><option value="desktop">Desktop</option><option value="tablet">Tablet</option>
            </Select>
            <Select label="Source" value={filters.source} onChange={(v) => set('source', v)}>
              <option value="">Any</option><option value="direct">Direct / unknown</option><option value="qr">QR code scans</option>
              {opts?.sources.filter((s) => s !== 'qr').map((s) => <option key={s} value={s}>{sourceName(s)}</option>)}
            </Select>
            <form className="col-span-2 flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); set('user', user.trim().replace(/^@/, '')) }}>
              <label htmlFor="traffic-user" className="label-form text-[10px]">One page (username)</label>
              <div className="flex gap-2">
                <input id="traffic-user" value={user} onChange={(e) => setUser(e.target.value)} placeholder="e.g. moyosore" className={`${field} min-w-0 flex-1`} />
                <button className="inline-flex h-9 items-center gap-1 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"><Search className="size-4" aria-hidden="true" /> Apply</button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>

      {error ? <p className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">{error}</p>
        : !data ? <div className="grid h-48 place-items-center"><Loader2 className="animate-spin text-muted-foreground" role="status" aria-label="Loading" /></div>
        : (<>
          <WeekSummary week={data.week} subject={filters.user ? `/${filters.user}` : active.length ? 'These pages' : 'linqsafe pages'} own="the" />

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
            <Kpi icon={Eye} label="Page views" info="Profile page loads matching the filters. Your own visits while signed in, bots, and refreshes within 30 minutes aren't counted." value={data.views.toLocaleString()} />
            <Kpi icon={Users} label="Unique visitors" info="Distinct visitor cookies matching the filters. Only visitors who accepted the cookie notice are counted." value={data.visitors.toLocaleString()} />
            <Kpi icon={MousePointerClick} label="Link clicks" info="Taps on links and social icons on the filtered pages." value={data.clicks.toLocaleString()} />
            <Kpi icon={Percent} label="Click-through rate" info="Link clicks ÷ page views. 20% means one click for every five views." value={ctr} />
            <Kpi icon={QrCode} label="QR code scans" info="Views that came from a downloaded QR code (its link carries ?src=qr)." value={data.qrScans.toLocaleString()} />
            <Kpi icon={LayoutTemplate} label="Pages visited" info="Pages that got at least one view in this view." value={data.activePages.toLocaleString()} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">Views and clicks <InfoTip>Views and clicks per day in the range (days run on the server's calendar).</InfoTip></CardTitle>
              <CardDescription className="flex flex-wrap gap-4">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIEWS }} />Views</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: CLICKS }} />Clicks</span>
              </CardDescription>
            </CardHeader>
            <CardContent><LineChart series={data.series} /></CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-5" aria-hidden="true" /> Best time to post <InfoTip>Views + clicks grouped by weekday and hour, shifted into your own time zone. The darkest cell is the busiest hour.</InfoTip></CardTitle></CardHeader>
              <CardContent><BestTime heat={data.heat} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Repeat className="size-5" aria-hidden="true" /> New vs returning <InfoTip>Counted visitors only (cookie accepted). Returning = seen on any page before this range, or on 2+ different days inside it. Everyone else is new.</InfoTip></CardTitle>
                <CardDescription>Across the whole site: a visitor seen on another day, on any page, is returning.</CardDescription></CardHeader>
              <CardContent><NewVsReturning audience={data.audience} /></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">Pages <InfoTip>Per page in this view: views, distinct visitors, clicks, and CTR (clicks ÷ views).</InfoTip></CardTitle><CardDescription>Most-visited pages in this view. Click a name to see only that page.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              {data.pages.length ? (
                <table className="w-full min-w-[32rem] text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-1.5 font-medium">Page</th><th className="font-medium">Type</th><th className="text-right font-medium">Views</th><th className="text-right font-medium">Visitors</th><th className="text-right font-medium">Clicks</th><th className="text-right font-medium">CTR</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.pages.map((p, i) => (
                      <motion.tr key={p.username} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }} className="border-t">
                        <td className="py-1.5">
                          <button onClick={() => set('user', p.username)} className="font-medium hover:underline">/{p.username}</button>
                          <Link to={`/${p.username}`} className="ml-2 text-xs text-muted-foreground hover:underline">open</Link>
                        </td>
                        <td className="capitalize text-muted-foreground">{p.account_type}</td>
                        <td className="text-right">{p.views}</td><td className="text-right">{p.visitors}</td><td className="text-right">{p.clicks}</td>
                        <td className="text-right">{p.views ? pct(p.clicks / p.views) : '–'}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="py-6 text-center text-sm text-muted-foreground">No visits match these filters.</p>}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><MousePointerClick className="size-5" aria-hidden="true" /> Top links <InfoTip>Most-clicked links. The % is the link's clicks ÷ all page views in this view.</InfoTip></CardTitle>
                <CardDescription>Clicks, and share of all page views in this view.</CardDescription></CardHeader>
              <CardContent>
                <BarList color={CLICKS} empty="No clicks yet."
                  rows={data.links.map((l) => ({ key: l.id, label: `${l.title} · /${l.username}`, n: l.n, display: `${l.n} · ${pct(l.rate)}`, icon: <TypeBadge type={l.type} className="size-5" /> }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">Clicks by platform <InfoTip>Clicks grouped by the link's detected type (Instagram, Shop…).</InfoTip></CardTitle><CardDescription>Which kinds of links people tap.</CardDescription></CardHeader>
              <CardContent>
                <BarList color={CLICKS} empty="No clicks yet."
                  rows={data.linkTypes.map((t) => ({ key: t.name || 'link', label: t.name ? t.name[0].toUpperCase() + t.name.slice(1) : 'Link', n: t.n, icon: <TypeBadge type={t.name} className="size-5" /> }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Globe2 className="size-5" aria-hidden="true" /> Countries <InfoTip>From Cloudflare's visitor-country header when present, otherwise the visitor's browser time zone. Unknown = neither available.</InfoTip></CardTitle></CardHeader>
              <CardContent>
                <BarList empty="No visits yet." rows={data.countries.map((c) => ({ key: c.name || 'xx', label: c.name ? regionName(c.name) : 'Unknown', n: c.n, icon: <span aria-hidden="true">{c.name ? flag(c.name) : '🌐'}</span> }))} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">Where visitors come from <InfoTip>The website the visitor came from (the referrer). Direct = no referrer, e.g. typed, apps that hide it, or QR.</InfoTip></CardTitle></CardHeader>
              <CardContent><BarList empty="No visits yet." rows={data.referrers.map((r) => ({ key: r.name || 'direct', label: sourceName(r.name), n: r.n }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="size-5" aria-hidden="true" /> Devices <InfoTip>From the browser's user agent: mobile, tablet or desktop.</InfoTip></CardTitle></CardHeader>
              <CardContent><BarList empty="No visits yet." rows={data.devices.map((d) => ({ key: d.name || 'x', label: d.name ? d.name[0].toUpperCase() + d.name.slice(1) : 'Unknown', n: d.n }))} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2">Views by account and template <InfoTip>Views split by the page owner's account type, then by their current template.</InfoTip></CardTitle></CardHeader>
              <CardContent className="space-y-5">
                <BarList empty="No visits yet." rows={data.byAccount.map((a) => ({ key: a.name, label: a.name === 'business' ? 'Business pages' : 'Personal pages', n: a.n }))} />
                <BarList empty="" rows={data.byTemplate.map((t) => ({ key: t.name, label: tplName[t.name] || t.name, n: t.n }))} />
              </CardContent>
            </Card>
          </div>
          {filters.category && <p className="text-xs text-muted-foreground">Showing {categoryLabel(filters.category) || filters.category} pages only.</p>}
        </>)}
    </section>
  )
}
