import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Home, LayoutDashboard, LogIn, Mail, Menu, Rocket, ShieldCheck, FileText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
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

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const linkClass = ({ isActive }) =>
    `inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-foreground ${isActive ? 'text-foreground' : 'text-muted-foreground'}`

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
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
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav" aria-label="Mobile"
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t md:hidden" onClick={() => setOpen(false)}
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
        {SITE.name}
      </motion.p>
    </footer>
  )
}

export default function Layout() {
  const { pathname } = useLocation()
  const main = useRef(null)
  const first = useRef(true)
  const [announce, setAnnounce] = useState('')

  // On client-side navigation, move focus to the page and announce its title (SPAs don't do this natively).
  useEffect(() => {
    if (first.current) { first.current = false; return }
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
    setAnnounce(document.title)
  }, [pathname])

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
        <Outlet />
      </motion.main>
      <Footer />
    </div>
  )
}
