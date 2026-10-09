import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Banknote, ChevronsLeft, ChevronsRight, CreditCard, Gauge, LogOut, Mail, RefreshCw, ShieldAlert, Tag, TrendingUp, UserPlus, Users } from 'lucide-react'
import { api, logout } from '@/api'
import { IS_ADMIN_HOST, STAGE } from '@/lib/stage'

// Founder console routes live at / on admin.<domain> and under /owner on the main site.
export const ownerBase = IS_ADMIN_HOST ? '' : '/owner'

const NAV = [
  ['Overview', Gauge, '', 'overview'], ['Growth', TrendingUp, '', 'growth'], ['Revenue', Banknote, '', 'revenue'],
  ['Traffic', Activity, '', 'traffic'], ['Pricing', Tag, '', 'pricing'], ['Payments', CreditCard, '', 'payments'],
  ['Signups', UserPlus, '', 'signups'], ['Messages', Mail, '', 'messages'], ['All users', Users, '/users', null],
  ['Fraud & risk', ShieldAlert, '/risk', null],
]

const readCollapsed = () => { try { return localStorage.getItem('owner_nav') === 'collapsed' } catch { return false } }

// Founder console frame, responsive with Tailwind only: on large screens a collapsible sidebar (icons only
// when collapsed); on phones and tablets a sticky row of chips that scrolls sideways. A toolbar shows who's
// signed in, page-specific controls (`tools`), refresh and log out, and wraps onto two lines on phones.
export default function OwnerShell({ title, tools, onRefresh, children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [me, setMe] = useState(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => { api('/me').then(setMe).catch(() => {}) }, [])
  useEffect(() => { try { localStorage.setItem('owner_nav', collapsed ? 'collapsed' : 'open') } catch { /* storage blocked */ } }, [collapsed])

  const home = ownerBase || '/'
  const go = (path, anchor) => (e) => {
    if (!anchor) return
    e.preventDefault()
    const jump = () => document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (pathname === home) jump()
    else { navigate(home); setTimeout(jump, 400) }
  }

  const nav = (wide) => (
    <nav aria-label="Founder console" className="space-y-0.5">
      {NAV.map(([label, Icon, path, anchor]) => {
        const to = (ownerBase + path) || '/'
        const cls = ({ isActive } = {}) => `flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors ${isActive && !anchor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} ${wide ? '' : 'justify-center'}`
        return anchor
          ? <a key={label} href={`${to}#${anchor}`} onClick={go(path, anchor)} className={cls()} title={wide ? undefined : label}><Icon className="size-4 shrink-0" aria-hidden="true" />{wide ? label : <span className="sr-only">{label}</span>}</a>
          : <NavLink key={label} to={to} end className={cls} title={wide ? undefined : label}><Icon className="size-4 shrink-0" aria-hidden="true" />{wide ? label : <span className="sr-only">{label}</span>}</NavLink>
      })}
    </nav>
  )

  const signOut = async () => { await logout(); navigate('/login') }

  return (
    <div className={`container grid gap-4 py-4 sm:gap-6 sm:py-6 ${collapsed ? 'lg:grid-cols-[3.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[13rem_minmax(0,1fr)]'}`}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 space-y-3 rounded-xl border bg-card/80 p-2 backdrop-blur">
          <button type="button" onClick={() => setCollapsed((c) => !c)} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted ${collapsed ? 'justify-center' : 'justify-between'}`}>
            {!collapsed && <span>Founder · {STAGE}</span>}
            {collapsed ? <ChevronsRight className="size-4" aria-hidden="true" /> : <ChevronsLeft className="size-4" aria-hidden="true" />}
          </button>
          {nav(!collapsed)}
        </div>
      </aside>

      <div className="min-w-0 space-y-6">
        {/* Phones and tablets: sticky chips that scroll sideways (no drawer, CSS only). */}
        <nav aria-label="Founder console" className="sticky top-16 z-30 -mx-4 overflow-x-auto border-b bg-background/90 px-4 py-2 backdrop-blur [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
          <div className="flex w-max gap-1.5">
            {NAV.map(([label, Icon, path, anchor]) => {
              const to = (ownerBase + path) || '/'
              const chip = 'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium'
              return anchor
                ? <a key={label} href={`${to}#${anchor}`} onClick={go(path, anchor)} className={`${chip} bg-card text-muted-foreground`}><Icon className="size-3.5" aria-hidden="true" />{label}</a>
                : <NavLink key={label} to={to} end className={({ isActive }) => `${chip} ${isActive ? 'border-foreground bg-foreground text-background' : 'bg-card text-muted-foreground'}`}><Icon className="size-3.5" aria-hidden="true" />{label}</NavLink>
            })}
          </div>
        </nav>
        {/* Toolbar */}
        <div role="toolbar" aria-label="Founder tools" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/80 p-2 backdrop-blur">
          <h1 className="min-w-0 basis-full truncate px-1 text-lg font-bold tracking-tight sm:basis-0 sm:flex-1">{title}</h1>
          {tools}
          {onRefresh && <button type="button" onClick={onRefresh} aria-label="Refresh" title="Refresh" className="grid size-9 place-items-center rounded-md border hover:bg-muted"><RefreshCw className="size-4" /></button>}
          {me && (
            <span className="ml-auto flex min-w-0 items-center gap-2 rounded-md border px-2 py-1 sm:ml-0" title={me.email}>
              {me.avatar_url
                ? <img src={me.avatar_url} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                : <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">{(me.display_name || me.username || '?')[0].toUpperCase()}</span>}
              <span className="hidden min-w-0 leading-tight sm:block">
                <span className="block truncate text-xs font-semibold">{me.display_name || `@${me.username}`}</span>
                <span className="block max-w-[12rem] truncate text-[11px] text-muted-foreground">{me.email}</span>
              </span>
            </span>
          )}
          {!IS_ADMIN_HOST && <Link to="/admin" className="hidden h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-muted sm:inline-flex">My page</Link>}
          <button type="button" onClick={signOut} aria-label="Log out" title="Log out" className="grid size-9 place-items-center rounded-md border hover:bg-muted"><LogOut className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
