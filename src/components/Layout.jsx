import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Home, LayoutDashboard, LogIn, Mail, Menu, Rocket, ShieldCheck, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import ErrorBoundary from '@/components/ErrorBoundary'
import AppearanceToggle from '@/components/AppearanceToggle'
import { isSignedIn } from '@/api'
import { SITE } from '@/config'

const nav = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/contact', label: 'Contact', icon: Mail },
]

function Navbar() {
  const [open, setOpen] = useState(false)
  const loggedIn = isSignedIn()
  const { pathname } = useLocation()
  // Transparent at the top so the page's colours run behind it; a floating frosted pill once you scroll.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => setOpen(false), [pathname])

  // Sections marked data-hide-nav (the home page's feature showcase) get the full screen: the bar slides
  // away while one of them is at the top, and comes back after.
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver((entries) => setHidden(entries.some((e) => e.isIntersecting)), { rootMargin: '0px 0px -95% 0px' })
    const seen = new Set()
    // Pages load lazily, so keep watching for marked sections to appear.
    const attach = () => document.querySelectorAll('[data-hide-nav]').forEach((t) => { if (!seen.has(t)) { seen.add(t); io.observe(t) } })
    attach()
    const mo = new MutationObserver(attach)
    mo.observe(document.body, { childList: true, subtree: true })
    return () => { io.disconnect(); mo.disconnect(); setHidden(false) }
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground ${isActive ? 'text-foreground' : 'text-muted-foreground'}`

  return (
    <header className={`sticky top-0 z-40 h-16 transition-transform duration-300 ${hidden && !open ? '-translate-y-[120%]' : ''}`}>
      <motion.div
        animate={scrolled || open
          ? { marginTop: 8, borderRadius: 999, backgroundColor: 'hsl(var(--background) / 0.72)', boxShadow: '0 10px 30px -12px hsl(20 35% 18% / 0.25), inset 0 0 0 1px hsl(var(--foreground) / 0.08)' }
          : { marginTop: 0, borderRadius: 0, backgroundColor: 'hsl(var(--background) / 0)', boxShadow: '0 0 0 0 hsl(20 35% 18% / 0), inset 0 0 0 0 hsl(var(--foreground) / 0)' }}
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
        className={`container flex items-center justify-between backdrop-blur-md transition-[height,max-width,padding] duration-300 ${scrolled || open ? 'h-14 max-w-[1100px] px-3 sm:px-4' : 'h-16'}`}>
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          <AppearanceToggle />
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}><n.icon className="size-4" aria-hidden="true" />{n.label}</NavLink>
          ))}
          {loggedIn ? (
            <Button asChild size="sm"><Link to="/admin"><LayoutDashboard />Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login"><LogIn />Log in</Link></Button>
              <Button asChild size="sm"><Link to="/signup"><Rocket />Get started</Link></Button>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
        <AppearanceToggle />
        <Button variant="ghost" size="icon" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
        </div>
      </motion.div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav" aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="mx-3 mt-2 overflow-hidden rounded-2xl bg-background/90 shadow-lg ring-1 ring-foreground/10 backdrop-blur-md md:hidden" onClick={() => setOpen(false)}
          >
            <div className="container flex flex-col gap-3 py-4">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}><n.icon className="size-4" aria-hidden="true" />{n.label}</NavLink>
              ))}
              {loggedIn ? (
                <Button asChild><Link to="/admin"><LayoutDashboard />Dashboard</Link></Button>
              ) : (
                <>
                  <Button asChild variant="outline"><Link to="/login"><LogIn />Log in</Link></Button>
                  <Button asChild><Link to="/signup"><Rocket />Get started</Link></Button>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

const FOOTER_COLS = [
  ['Product', [['/', 'Home'], ['/pricing', 'Pricing'], ['/signup', 'Create your page'], ['/login', 'Log in']]],
  ['Company', [['/contact', 'Contact'], ['/terms', 'Terms'], ['/privacy', 'Privacy']]],
]

function Footer() {
  const reveal = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }
  return (
    <footer className="relative overflow-hidden bg-[hsl(20_16%_12%)] text-[hsl(36_30%_90%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_20rem_at_90%_0%,hsl(var(--accent)/.35),transparent_70%),radial-gradient(30rem_18rem_at_0%_100%,hsl(var(--lilac)/.12),transparent_70%)]" />
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.08 } } }} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }}
        className="container relative grid gap-10 pb-10 pt-16 md:grid-cols-[1.4fr_1fr_1fr]"
      >
        <motion.div variants={reveal}>
          <div className="[&_a]:text-[hsl(36_30%_94%)]"><Logo /></div>
          <p className="mt-4 max-w-xs text-sm text-[hsl(36_20%_75%)]">{SITE.tagline} Made for creators and small businesses.</p>
          <motion.div whileHover={{ x: 3 }} className="mt-6 inline-block">
            <Link to="/signup" className="group inline-flex items-center gap-2 rounded-full bg-[hsl(36_30%_94%)] px-5 py-2.5 text-sm font-semibold text-[hsl(20_16%_12%)]">
              Make your page <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
            </Link>
          </motion.div>
        </motion.div>
        {FOOTER_COLS.map(([title, links]) => (
          <motion.nav key={title} variants={reveal} aria-label={title}>
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(36_20%_65%)]">{title}</p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {links.map(([to, label]) => (
                <li key={to}>
                  <Link to={to} className="relative inline-block after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform hover:after:scale-x-100">{label}</Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        ))}
      </motion.div>

      <div className="container relative flex flex-wrap items-center justify-between gap-4 border-t border-white/10 py-6 text-xs text-[hsl(36_20%_70%)]">
        <p>© {new Date().getFullYear()} {SITE.company}. All rights reserved.</p>
        <motion.button type="button" whileHover={{ y: -3 }} whileTap={{ scale: 0.9 }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 hover:bg-white/5">
          <ArrowUp className="size-3.5" aria-hidden="true" /> Back to top
        </motion.button>
      </div>

      {/* Oversized wordmark that rises into view and fades into the footer (Volasec-style watermark). */}
      <motion.p aria-hidden="true"
        initial={{ y: '40%', opacity: 0 }} whileInView={{ y: '18%', opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        className="pointer-events-none select-none text-center font-display text-[22vw] font-extrabold leading-[0.8] tracking-tighter text-transparent [-webkit-text-stroke:1px_hsl(36_30%_90%/.12)] [background:linear-gradient(to_bottom,hsl(36_30%_90%/.10),transparent_75%)] [-webkit-background-clip:text] [background-clip:text]">
        {SITE.name}.
      </motion.p>
    </footer>
  )
}

// Remembers where you were on each page. A reload, or Back / Forward, brings you back to that spot once the
// page's content has loaded (it keeps trying for a few seconds and stops as soon as you scroll yourself).
const scrollKey = (loc) => `scroll:${loc.pathname}${loc.search}`
const readScroll = (key) => { try { return Number(sessionStorage.getItem(key)) || 0 } catch { return 0 } }
function restoreScroll(y) {
  if (!y) return () => {}
  let stop = false
  const quit = () => { stop = true }
  const opts = { passive: true, once: true }
  for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) window.addEventListener(ev, quit, opts)
  const started = performance.now()
  const tick = () => {
    if (stop) return
    const max = document.documentElement.scrollHeight - innerHeight
    window.scrollTo(0, Math.min(y, max))
    if (max >= y - 2 || performance.now() - started > 4000) return
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  return quit
}

export default function Layout() {
  const location = useLocation()
  const { pathname } = location
  const navType = useNavigationType()
  const main = useRef(null)
  const first = useRef(true)
  const [announce, setAnnounce] = useState('')

  // Save the position as you scroll (and when leaving), per page.
  useEffect(() => {
    try { history.scrollRestoration = 'manual' } catch { /* old browser */ }
    const key = scrollKey(location)
    let raf = 0
    const save = () => { try { sessionStorage.setItem(key, String(Math.round(scrollY))) } catch { /* storage blocked */ } }
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(save) }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('pagehide', save)
    return () => { cancelAnimationFrame(raf); removeEventListener('scroll', onScroll); removeEventListener('pagehide', save) }
  }, [location.pathname, location.search]) // eslint-disable-line react-hooks/exhaustive-deps

  // First load (incl. a reload): go back to where you were, unless the address points at a section (#…).
  useEffect(() => (location.hash ? undefined : restoreScroll(readScroll(scrollKey(location)))), []) // eslint-disable-line react-hooks/exhaustive-deps

  // On client-side navigation, move focus to the page and announce its title (SPAs don't do this natively).
  // Back / Forward return to the old spot; a new page starts at the top.
  useEffect(() => {
    if (first.current) { first.current = false; return }
    main.current?.focus({ preventScroll: true })
    setAnnounce(document.title)
    if (navType === 'POP') return restoreScroll(readScroll(scrollKey(location)))
    window.scrollTo(0, 0)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <Navbar />
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <motion.main
        id="main" ref={main} tabIndex={-1}
        key={pathname}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
        className="flex-1 outline-none"
      >
        <ErrorBoundary resetKey={pathname}><Outlet /></ErrorBoundary>
      </motion.main>
      <Footer />
    </div>
  )
}
