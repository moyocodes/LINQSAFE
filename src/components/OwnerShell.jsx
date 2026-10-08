import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Activity, Banknote, ChevronsLeft, ChevronsRight, CreditCard, Gauge, LogOut, Mail, Menu, RefreshCw, Tag, TrendingUp, UserPlus, Users, X } from 'lucide-react'
import { api, logout } from '@/api'
import { IS_ADMIN_HOST, STAGE } from '@/lib/stage'

// Founder console routes live at / on admin.<domain> and under /owner on the main site.
export const ownerBase = IS_ADMIN_HOST ? '' : '/owner'

const NAV = [
  ['Overview', Gauge, '', 'overview'], ['Growth', TrendingUp, '', 'growth'], ['Revenue', Banknote, '', 'revenue'],
  ['Traffic', Activity, '', 'traffic'], ['Pricing', Tag, '', 'pricing'], ['Payments', CreditCard, '', 'payments'],
  ['Signups', UserPlus, '', 'signups'], ['Messages', Mail, '', 'messages'], ['All users', Users, '/users', null],
]

const readCollapsed = () => { try { return localStorage.getItem('owner_nav') === 'collapsed' } catch { return false } }

// Founder console frame: a collapsible sidebar (icons only when collapsed; a drawer on phones) and a
// toolbar with who's signed in, page-specific controls (`tools`), refresh and log out.
export default function OwnerShell({ title, tools, onRefresh, children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [open, setOpen] = useState(false)
  const [me, setMe] = useState(null)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  useEffect(() => { api('/me').then(setMe).catch(() => {}) }, [])
  useEffect(() => { try { localStorage.setItem('owner_nav', collapsed ? 'collapsed' : 'open') } catch { /* storage blocked */ } }, [collapsed])
  useEffect(() => setOpen(false), [pathname])

  const home = ownerBase || '/'
  const go = (path, anchor) => (e) => {
    setOpen(false)
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
    <div className={`container grid gap-6 py-6 ${collapsed ? 'lg:grid-cols-[3.5rem_minmax(0,1fr)]' : 'lg:grid-cols-[13rem_minmax(0,1fr)]'}`}>
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

      {/* Phone / tablet drawer */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.div role="dialog" aria-modal="true" aria-label="Founder console menu" onClick={(e) => e.stopPropagation()}
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="h-full w-64 space-y-3 overflow-y-auto bg-card p-3 shadow-2xl">
              <div className="flex items-center justify-between px-2.5 py-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Founder · {STAGE}</span>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-8 place-items-center rounded-md hover:bg-muted"><X className="size-4" /></button>
              </div>
              {nav(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-w-0 space-y-6">
        {/* Toolbar */}
        <div role="toolbar" aria-label="Founder tools" className="flex flex-wrap items-center gap-2 rounded-xl border bg-card/80 p-2 backdrop-blur">
          <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" className="grid size-9 place-items-center rounded-md hover:bg-muted lg:hidden"><Menu className="size-4" /></button>
          <h1 className="min-w-0 flex-1 truncate px-1 text-lg font-bold tracking-tight">{title}</h1>
          {tools}
          {onRefresh && <button type="button" onClick={onRefresh} aria-label="Refresh" title="Refresh" className="grid size-9 place-items-center rounded-md border hover:bg-muted"><RefreshCw className="size-4" /></button>}
          {me && (
            <span className="flex min-w-0 items-center gap-2 rounded-md border px-2 py-1" title={me.email}>
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
