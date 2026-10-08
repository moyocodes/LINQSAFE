import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, CalendarClock, Eye, Globe2, Loader2, Lock, QrCode, Repeat, TrendingDown, TrendingUp, MousePointerClick, Percent, Smartphone, Table2, Users } from 'lucide-react'
import { api } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TypeBadge } from '@/lib/linkTypes'
import { useTitle } from '@/lib/useTitle'

// Validated two-series palette (blue / orange, passes CVD + contrast checks on the light surface).
const VIEWS = '#2a78d6'
const CLICKS = '#eb6834'

export const regionName = (() => {
  try { const d = new Intl.DisplayNames(undefined, { type: 'region' }); return (c) => d.of(c) } catch { return (c) => c }
})()
export const flag = (c) => String.fromCodePoint(...[...c].map((ch) => 0x1f1a5 + ch.charCodeAt(0)))
export const fmtDay = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

export function Kpi({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="eyebrow flex items-center gap-1.5"><Icon className="size-3.5" aria-hidden="true" />{label}</p>
        <motion.p key={value} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</motion.p>
      </CardContent>
    </Card>
  )
}

export function LineChart({ series }) {
  const wrap = useRef(null)
  const [w, setW] = useState(640)
  const [hover, setHover] = useState(null)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])
  const h = 220, pad = { l: 32, r: 12, t: 12, b: 24 }
  const max = Math.max(4, ...series.map((s) => Math.max(s.views, s.clicks)))
  const step = Math.ceil(max / 4)
  const top = step * 4
  const x = (i) => pad.l + (i * (w - pad.l - pad.r)) / Math.max(1, series.length - 1)
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / top)
  const path = (k) => series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join('')
  const area = (k) => `${path(k)}L${x(series.length - 1)},${y(0)}L${x(0)},${y(0)}Z`
  const labelEvery = Math.ceil(series.length / 6)

  function onMove(e) {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - r.left - pad.l) / (w - pad.l - pad.r)) * (series.length - 1))
    setHover(Math.min(series.length - 1, Math.max(0, i)))
  }
  const hs = hover != null ? series[hover] : null

  return (
    <div ref={wrap} className="relative">
      <svg width={w} height={h} role="img" aria-label="Daily views and clicks" onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
        {[0, 1, 2, 3, 4].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t * step)} y2={y(t * step)} stroke="currentColor" className="text-foreground/10" />
            <text x={pad.l - 6} y={y(t * step)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">{t * step}</text>
          </g>
        ))}
        {series.map((s, i) => i % labelEvery === 0 && (
          <text key={s.date} x={x(i)} y={h - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">{fmtDay(s.date)}</text>
        ))}
        <path d={area('views')} fill={VIEWS} opacity="0.08" />
        <motion.path d={path('views')} fill="none" stroke={VIEWS} strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9 }} />
        <motion.path d={path('clicks')} fill="none" stroke={CLICKS} strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.15 }} />
        {hs && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke="currentColor" className="text-foreground/30" />
            <circle cx={x(hover)} cy={y(hs.views)} r="4.5" fill={VIEWS} stroke="hsl(var(--card))" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(hs.clicks)} r="4.5" fill={CLICKS} stroke="hsl(var(--card))" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hs && (
        <div className="pointer-events-none absolute top-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) - 70, 0), w - 140) }}>
          <p className="font-semibold">{fmtDay(hs.date)}</p>
          <p className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: VIEWS }} />Views <b className="ml-auto pl-3 tabular-nums">{hs.views}</b></p>
          <p className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: CLICKS }} />Clicks <b className="ml-auto pl-3 tabular-nums">{hs.clicks}</b></p>
        </div>
      )}
    </div>
  )
}

export function BarList({ rows, empty = 'No data yet.', color = VIEWS }) {
  const max = Math.max(1, ...rows.map((r) => r.n))
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.key ?? r.label} className="group" title={`${r.label}: ${r.n}`}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 truncate">{r.icon}{r.label}</span>
            <span className="font-semibold tabular-nums">{r.display ?? r.n.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-foreground/5">
            <motion.div className="h-full rounded-full" style={{ background: color }}
              initial={{ width: 0 }} animate={{ width: `${(r.n / max) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Friendly names for where visitors came from (referrer domains are stored as-is).
const SOURCES = [[/(^|\.)instagram\.com$/, 'Instagram'], [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)(t\.co|x\.com|twitter\.com)$/, 'X / Twitter'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'], [/(^|\.)(facebook\.com|fb\.com)$/, 'Facebook'], [/(^|\.)(whatsapp\.com|wa\.me)$/, 'WhatsApp'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn'], [/(^|\.)google\./, 'Google'], [/(^|\.)snapchat\.com$/, 'Snapchat'], [/(^|\.)pinterest\./, 'Pinterest']]
export const sourceName = (host) => (host === 'qr' ? 'QR code scans' : !host ? 'Direct / unknown' : SOURCES.find(([re]) => re.test(host))?.[1] || host)

const pct = (x) => `${(x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0)}%`
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`

function WeekSummary({ week }) {
  const parts = []
  const trend = (c, what) => (c == null ? null : c === 0 ? `the same ${what} as last week` : `${Math.abs(c)}% ${c > 0 ? 'more' : 'fewer'} ${what} than last week`)
  const t1 = trend(week.clicksChange, 'clicks'), t2 = trend(week.viewsChange, 'views')
  if (t1 || t2) parts.push(`Your page got ${[t2, t1].filter(Boolean).join(' and ')}.`)
  else parts.push(`This week: ${week.views} views and ${week.clicks} clicks.`)
  if (week.bestLink) parts.push(`${week.bestLink.title} was your best link (${week.bestLink.clicks} click${week.bestLink.clicks === 1 ? '' : 's'}).`)
  const up = (week.clicksChange ?? week.viewsChange ?? 0) >= 0
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="paper frame flex items-start gap-3 rounded-md px-5 py-4">
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-accent/10 text-accent'}`}>
        {up ? <TrendingUp className="size-4" aria-hidden="true" /> : <TrendingDown className="size-4" aria-hidden="true" />}
      </span>
      <p className="font-serif text-lg leading-snug"><span className="label-form mr-2 align-middle">This week</span>{parts.join(' ')}</p>
    </motion.div>
  )
}

// Day × hour grid of activity (views + clicks), shifted from UTC into the viewer's local time.
function BestTime({ heat }) {
  const off = Math.round(-new Date().getTimezoneOffset() / 60)
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const c of heat) {
    let h = c.h + off, d = c.d
    if (h >= 24) { h -= 24; d = (d + 1) % 7 } else if (h < 0) { h += 24; d = (d + 6) % 7 }
    grid[d][h] += c.views + c.clicks
  }
  const max = Math.max(0, ...grid.flat())
  let best = null
  grid.forEach((row, d) => row.forEach((v, h) => { if (v && (!best || v > best.v)) best = { d, h, v } }))
  return (
    <div>
      <p className="mb-3 text-sm">{best ? <>Busiest: <strong>{DAYS[best.d]}, {hourLabel(best.h)}–{hourLabel((best.h + 1) % 24)}</strong>. Post just before then.</> : 'Not enough activity yet.'}</p>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full grid-cols-[2.5rem_repeat(24,minmax(0.9rem,1fr))] gap-[2px] text-[10px] text-muted-foreground" role="img"
          aria-label={best ? `Busiest time ${DAYS[best.d]} ${hourLabel(best.h)}` : 'No activity yet'}>
          <span />
          {Array.from({ length: 24 }, (_, h) => <span key={h} className="text-center">{h % 6 === 0 ? hourLabel(h) : ''}</span>)}
          {grid.map((row, d) => [
            <span key={`l${d}`} className="pr-1 leading-[1rem]">{DAYS[d]}</span>,
            ...row.map((v, h) => (
              <motion.span key={`${d}-${h}`} title={`${DAYS[d]} ${hourLabel(h)}: ${v}`}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: (d * 24 + h) * 0.002 }}
                className="h-4 rounded-[2px]" style={{ background: v ? `hsl(348 42% 33% / ${0.15 + 0.85 * (v / max)})` : 'hsl(var(--foreground) / 0.05)' }} />
            )),
          ])}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Darker = more views and clicks. Shown in your local time.</p>
    </div>
  )
}

function NewVsReturning({ audience }) {
  const { total, returning } = audience
  const fresh = total - returning
  if (!total) return <p className="py-6 text-center text-sm text-muted-foreground">No counted visitors yet. Visitors are counted once they accept the cookie notice.</p>
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-foreground/5" role="img" aria-label={`${fresh} new, ${returning} returning`}>
        <motion.div initial={{ width: 0 }} animate={{ width: `${(fresh / total) * 100}%` }} className="h-full" style={{ background: VIEWS }} />
        <motion.div initial={{ width: 0 }} animate={{ width: `${(returning / total) * 100}%` }} className="h-full border-l-2 border-card" style={{ background: CLICKS }} />
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: VIEWS }} />New <b className="tabular-nums">{fresh}</b> <span className="text-muted-foreground">({pct(fresh / total)})</span></span>
        <span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ background: CLICKS }} />Returning <b className="tabular-nums">{returning}</b> <span className="text-muted-foreground">({pct(returning / total)})</span></span>
      </div>
    </div>
  )
}

export default function Analytics() {
  useTitle('Analytics')
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [table, setTable] = useState(false)
  const [long, setLong] = useState(null) // can this account see 90 days?
  useEffect(() => { api('/me').then((m) => setLong(!!m.features && 'analytics_90' in m.features)).catch(() => setLong(false)) }, [])

  useEffect(() => {
    setData(null)
    api(`/analytics?days=${days}`).then(setData).catch(() => navigate('/login'))
  }, [days, navigate])

  const ctr = useMemo(() => (data?.views ? `${((data.clicks / data.views) * 100).toFixed(1)}%` : '–'), [data])

  return (
    <div className="container space-y-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden="true" /> Dashboard</Link>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Analytics</h1>
        </div>
        <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-lg border bg-card p-1">
          {[7, 30, 90].map((d) => d === 90 && long === false ? (
            <Link key={d} to="/admin#analytics" title="90-day analytics is a paid feature"
              className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground line-through decoration-accent/50 hover:text-foreground">
              <Lock className="size-3.5" aria-hidden="true" /> 90 days<span className="sr-only"> (locked, unlock in Features)</span>
            </Link>
          ) : (
            <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)}
              className={`relative rounded-md px-3 py-1.5 text-sm font-medium ${days === d ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {days === d && <motion.span layoutId="range" className="absolute inset-0 rounded-md bg-primary" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
              <span className="relative">{d} days</span>
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="grid h-64 place-items-center"><Loader2 className="animate-spin text-muted-foreground" role="status" aria-label="Loading" /></div>
      ) : (<>
        <WeekSummary week={data.week} />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Kpi icon={Eye} label="Page views" value={data.views.toLocaleString()} />
          <Kpi icon={Users} label="Unique visitors" value={data.visitors.toLocaleString()} />
          <Kpi icon={MousePointerClick} label="Link clicks" value={data.clicks.toLocaleString()} />
          <Kpi icon={Percent} label="Click-through rate" value={ctr} />
          <Kpi icon={QrCode} label="QR code scans" value={data.qrScans.toLocaleString()} />
        </div>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Views and clicks</CardTitle>
              <CardDescription className="mt-1.5 flex flex-wrap gap-4">
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: VIEWS }} />Views</span>
                <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: CLICKS }} />Clicks</span>
              </CardDescription>
            </div>
            <button onClick={() => setTable(!table)} aria-pressed={table} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-muted">
              <Table2 className="size-3.5" aria-hidden="true" /> {table ? 'Chart' : 'Table'}
            </button>
          </CardHeader>
          <CardContent>
            {table ? (
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-muted-foreground"><tr><th className="py-1.5 font-medium">Date</th><th className="text-right font-medium">Views</th><th className="text-right font-medium">Clicks</th></tr></thead>
                  <tbody className="tabular-nums">
                    {[...data.series].reverse().map((s) => <tr key={s.date} className="border-t"><td className="py-1.5">{fmtDay(s.date)}</td><td className="text-right">{s.views}</td><td className="text-right">{s.clicks}</td></tr>)}
                  </tbody>
                </table>
              </div>
            ) : <LineChart series={data.series} />}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="size-5" aria-hidden="true" /> Best time to post</CardTitle></CardHeader>
            <CardContent><BestTime heat={data.heat} /></CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Repeat className="size-5" aria-hidden="true" /> New vs returning</CardTitle>
              <CardDescription>Visitors who came back on another day count as returning.</CardDescription></CardHeader>
            <CardContent><NewVsReturning audience={data.audience} /></CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MousePointerClick className="size-5" aria-hidden="true" /> Links by conversion</CardTitle>
              <CardDescription>Share of page views that clicked each link.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList color={CLICKS} empty="No links yet."
                rows={[...data.links].sort((a, b) => b.rate - a.rate).map((l) => ({ key: l.id, label: l.title, n: l.n, display: `${pct(l.rate)} · ${l.n}`, icon: <TypeBadge type={l.type} className="size-5" /> }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Globe2 className="size-5" aria-hidden="true" /> Countries</CardTitle>
              <CardDescription>Where your visitors are, from your host's location data or their device's time zone.</CardDescription>
            </CardHeader>
            <CardContent>
              <BarList empty="No visits yet."
                rows={data.countries.map((c) => ({ key: c.name || 'xx', label: c.name ? regionName(c.name) : 'Unknown', n: c.n, icon: <span aria-hidden="true">{c.name ? flag(c.name) : '🌐'}</span> }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Where visitors come from</CardTitle></CardHeader>
            <CardContent>
              <BarList empty="No visits yet." rows={data.referrers.map((r) => ({ key: r.name || 'direct', label: sourceName(r.name), n: r.n }))} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="size-5" aria-hidden="true" /> Devices</CardTitle></CardHeader>
            <CardContent>
              <BarList empty="No visits yet." rows={data.devices.map((d) => ({ key: d.name, label: d.name ? d.name[0].toUpperCase() + d.name.slice(1) : 'Unknown', n: d.n }))} />
            </CardContent>
          </Card>
        </div>
        <p className="text-xs text-muted-foreground">Your own visits while signed in aren't counted, and a refresh within 30 minutes counts as one view.</p>
      </>)}
    </div>
  )
}
