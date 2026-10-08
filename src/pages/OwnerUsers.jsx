import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Search, ShieldCheck, Users } from 'lucide-react'
import { api } from '@/api'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useTitle } from '@/lib/useTitle'
import { TEMPLATES, categoryLabel } from '@/lib/plans'
import OwnerShell from '@/components/OwnerShell'
import PageLoader from '@/components/PageLoader'

const tplName = Object.fromEntries(TEMPLATES.map((t) => [t.id, t.name]))
const SORTS = [['newest', 'Newest'], ['oldest', 'Oldest'], ['active', 'Last active'], ['views', 'Most views']]

// Founder console: every account, 25 per page. Page, search and sort live in the URL so they survive
// refresh and the back button.
export default function OwnerUsers() {
  useTitle('All users')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const page = Math.max(1, Number(params.get('page')) || 1)
  const q = params.get('q') || ''
  const sort = params.get('sort') || 'newest'
  const [search, setSearch] = useState(q)
  const [data, setData] = useState(null)
  const [denied, setDenied] = useState(false)
  const [reload, setReload] = useState(0)

  const update = (patch) => setParams((p) => {
    const next = new URLSearchParams(p)
    for (const [k, v] of Object.entries(patch)) (v && v !== 1 && v !== 'newest' ? next.set(k, v) : next.delete(k))
    return next
  })

  // Search as you type (debounced); a new search starts again at page 1.
  useEffect(() => {
    if (search === q) return
    const t = setTimeout(() => update({ q: search.trim(), page: 1 }), 350)
    return () => clearTimeout(t)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let live = true
    setData(null)
    api(`/owner/users?page=${page}&sort=${sort}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      .then((d) => live && setData(d))
      .catch((e) => live && (e.message === 'Not authenticated' ? navigate('/login') : setDenied(true)))
    return () => { live = false }
  }, [page, q, sort, reload, navigate])

  if (denied) return (
    <div className="container grid min-h-[50vh] place-items-center text-center">
      <div><ShieldCheck className="mx-auto size-10 text-muted-foreground" aria-hidden="true" /><h1 className="mt-3 text-2xl font-bold">Owner only</h1></div>
    </div>
  )

  const tools = (
    <>
      <label className="relative">
        <span className="sr-only">Search users</span>
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Username, name or email" className="h-9 w-56 max-w-full pl-8" />
      </label>
      <select value={sort} onChange={(e) => update({ sort: e.target.value, page: 1 })} aria-label="Sort users"
        className="h-9 rounded-md border bg-background px-2 text-sm">
        {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </>
  )

  const pager = data && data.pages > 1 && (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">Page {data.page} of {data.pages} · {data.total.toLocaleString()} users</span>
      <span className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => update({ page: page - 1 })} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 font-medium hover:bg-muted disabled:opacity-40"><ChevronLeft className="size-4" aria-hidden="true" /> Previous</button>
        {pageNumbers(data.page, data.pages).map((n, i) => n === '…'
          ? <span key={`gap${i}`} className="px-1 text-muted-foreground">…</span>
          : <button key={n} type="button" onClick={() => update({ page: n })} aria-current={n === data.page ? 'page' : undefined}
              className={`h-9 min-w-9 rounded-md px-2 font-medium tabular-nums ${n === data.page ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}>{n}</button>)}
        <button type="button" disabled={page >= data.pages} onClick={() => update({ page: page + 1 })} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 font-medium hover:bg-muted disabled:opacity-40">Next <ChevronRight className="size-4" aria-hidden="true" /></button>
      </span>
    </nav>
  )

  return (
    <OwnerShell title={<span className="flex items-center gap-2"><Users className="size-5 text-accent" aria-hidden="true" /> All users</span>} tools={tools} onRefresh={() => setReload((r) => r + 1)}>
      {!data ? <PageLoader label="Loading users" className="h-64" /> : (
        <Card>
          <CardContent className="space-y-4 p-4">
            {pager}
            {data.users.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[56rem] text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr><th className="py-2 font-medium">User</th><th className="font-medium">Email</th><th className="font-medium">Type</th><th className="font-medium">Template</th>
                      <th className="text-right font-medium">Links</th><th className="text-right font-medium">Views</th><th className="pl-4 font-medium">Paid</th><th className="font-medium">Joined</th><th className="font-medium">Last login</th></tr>
                  </thead>
                  <tbody>{data.users.map((u) => (
                    <tr key={u.username} className="border-t align-top">
                      <td className="py-2 pr-3">
                        <Link to={`/${u.username}`} target="_blank" className="font-medium hover:underline">@{u.username}</Link>
                        {u.display_name && <span className="block text-xs text-muted-foreground">{u.display_name}</span>}
                        {!u.onboarded && <span className="block text-xs text-muted-foreground">not onboarded</span>}
                      </td>
                      <td className="pr-3"><a href={`mailto:${u.email}`} className="break-all hover:underline">{u.email || '–'}</a>
                        {u.email && !u.email_verified && <span className="block text-xs text-amber-700">unverified</span>}</td>
                      <td>{u.account_type === 'business' ? categoryLabel(u.category) || 'Business' : 'Personal'}</td>
                      <td>{tplName[u.layout] || u.layout}</td>
                      <td className="text-right tabular-nums">{u.links}</td>
                      <td className="text-right tabular-nums">{Number(u.views || 0).toLocaleString()}</td>
                      <td className="pl-4">{u.paid_features ? <span className="font-semibold text-accent">{u.paid_features}</span> : <span className="text-muted-foreground">–</span>}</td>
                      <td className="whitespace-nowrap tabular-nums text-muted-foreground">{u.joined}</td>
                      <td className="whitespace-nowrap tabular-nums text-muted-foreground">{u.last_login || '–'}{u.login_count ? <span className="block text-xs">{u.login_count} logins</span> : null}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p className="py-10 text-center text-sm text-muted-foreground">{q ? `No users match "${q}".` : 'No users yet.'}</p>}
            {pager}
          </CardContent>
        </Card>
      )}
    </OwnerShell>
  )
}

// 1 … 4 5 [6] 7 8 … 20
function pageNumbers(current, total) {
  const keep = new Set([1, total, current, current - 1, current + 1, current - 2, current + 2].filter((n) => n >= 1 && n <= total))
  const sorted = [...keep].sort((a, b) => a - b)
  return sorted.flatMap((n, i) => (i && n - sorted[i - 1] > 1 ? ['…', n] : [n]))
}
