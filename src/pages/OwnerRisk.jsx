import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CreditCard, ExternalLink, Link2, MousePointerClick, ShieldAlert, ShieldCheck, UserX } from 'lucide-react'
import { api } from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'
import OwnerShell, { ownerBase } from '@/components/OwnerShell'
import PageLoader from '@/components/PageLoader'
import SuspendButton from '@/components/SuspendButton'

const SECTIONS = [
  ['links', 'Suspicious links', Link2, 'Shorteners, raw IP addresses, look-alike domains, phishing words, and new pages that send everyone elsewhere.'],
  ['accounts', 'Suspicious accounts', UserX, 'Throwaway emails, sign-up bursts, brand or "official" names, one WhatsApp number on many accounts.'],
  ['traffic', 'Fake traffic', MousePointerClick, 'One visitor clicking again and again, or impossible clicks-to-views ratios.'],
  ['payments', 'Payments', CreditCard, 'Repeated failed payments, underpayments, one card on many accounts.'],
]
const SEV = {
  high: 'bg-red-50 text-red-800 ring-red-200',
  medium: 'bg-amber-50 text-amber-900 ring-amber-200',
  low: 'bg-muted text-muted-foreground ring-foreground/10',
}

// Founder console: fraud & risk signals from the data we already have. Nothing is blocked automatically:
// each row says why it was flagged, and links to the page and the account.
export default function OwnerRisk() {
  useTitle('Fraud & risk')
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null)
  const [denied, setDenied] = useState(false)
  const [reload, setReload] = useState(0)
  useEffect(() => {
    setData(null)
    api(`/owner/risk?days=${days}`).then(setData).catch((e) => (e.message === 'Not authenticated' ? navigate('/login') : setDenied(true)))
  }, [days, reload, navigate])

  if (denied) return (
    <div className="container grid min-h-[50vh] place-items-center text-center">
      <div><ShieldCheck className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h1 className="mt-3 text-2xl font-bold">Owner only</h1></div>
    </div>
  )

  const range = (
    <div role="radiogroup" aria-label="Date range" className="inline-flex rounded-lg border bg-card p-1">
      {[7, 30, 90].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={days === n} onClick={() => setDays(n)}
          className={`rounded-md px-2.5 py-1 text-sm font-medium ${days === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{n}d</button>
      ))}
    </div>
  )

  return (
    <OwnerShell title={<span className="flex items-center gap-2"><ShieldAlert className="size-5 text-accent" aria-hidden="true" /> Fraud & risk</span>} tools={range} onRefresh={() => setReload((r) => r + 1)}>
      {!data ? <PageLoader label="Checking for risks" className="h-64" /> : (<>
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[['high', 'High'], ['medium', 'Medium'], ['low', 'Low']].map(([k, label]) => (
            <div key={k} className={`rounded-xl p-3 ring-1 ring-inset sm:p-4 ${SEV[k]}`}>
              <p className="text-2xl font-bold tabular-nums sm:text-3xl">{data.summary[k]}</p>
              <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Signals from the last {data.days} days (accounts, links and repeated details: all time). Nothing is blocked automatically; check each page before acting.</p>

        {data.summary.total === 0 && (
          <Card><CardContent className="flex items-center gap-3 p-6 text-sm"><ShieldCheck className="size-6 shrink-0 text-emerald-700" aria-hidden="true" />Nothing suspicious found in this range.</CardContent></Card>
        )}

        {SECTIONS.map(([key, title, Icon, about]) => {
          const rows = data.flags.filter((f) => f.section === key)
          if (!rows.length) return null
          return (
            <Card key={key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Icon className="size-5" aria-hidden="true" /> {title} <span className="text-sm font-normal text-muted-foreground">({rows.length})</span></CardTitle>
                <CardDescription>{about}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {rows.map((f, i) => (
                    <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}
                      className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:gap-3">
                      <span className={`w-fit shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ring-1 ring-inset ${SEV[f.severity]}`}>{f.severity}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{f.reason}{f.suspended && <span className="ml-2 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-background">Suspended</span>}</p>
                        {f.detail && <p className="break-words text-xs text-muted-foreground">{f.detail}</p>}
                      </div>
                      {f.username && (
                        <span className="flex shrink-0 flex-wrap gap-2 text-xs">
                          <Link to={`/${f.username}`} target="_blank" className="inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium hover:bg-muted">@{f.username} <ExternalLink className="size-3" aria-hidden="true" /></Link>
                          <Link to={`${ownerBase}/users?q=${encodeURIComponent(f.username)}`} className="inline-flex items-center rounded-md border px-2 py-1 font-medium hover:bg-muted">Account</Link>
                          <SuspendButton username={f.username} suspended={f.suspended}
                            onChange={(r) => setData((d) => ({ ...d, flags: d.flags.map((x) => (x.username === f.username ? { ...x, suspended: !!r.suspended } : x)) }))} />
                        </span>
                      )}
                    </motion.li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </>)}
    </OwnerShell>
  )
}
