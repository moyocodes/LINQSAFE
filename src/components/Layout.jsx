import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Logo from '@/components/Logo'
import { getToken } from '@/api'
import { SITE } from '@/config'

const nav = [
  { to: '/', label: 'Home', end: true },
  { to: '/contact', label: 'Contact' },
]

function Navbar() {
  const [open, setOpen] = useState(false)
  const loggedIn = !!getToken()
  const { pathname } = useLocation()

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors hover:text-foreground ${isActive ? 'text-foreground' : 'text-muted-foreground'}`

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>{n.label}</NavLink>
          ))}
          {loggedIn ? (
            <Button asChild size="sm"><Link to="/admin">Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/login">Log in</Link></Button>
              <Button asChild size="sm"><Link to="/signup">Get started</Link></Button>
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
                <NavLink key={n.to} to={n.to} end={n.end} className={linkClass}>{n.label}</NavLink>
              ))}
              {loggedIn ? (
                <Button asChild><Link to="/admin">Dashboard</Link></Button>
              ) : (
                <>
                  <Button asChild variant="outline"><Link to="/login">Log in</Link></Button>
                  <Button asChild><Link to="/signup">Get started</Link></Button>
                </>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} {SITE.company}. All rights reserved.</p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link className="hover:text-foreground" to="/terms">Terms</Link>
          <Link className="hover:text-foreground" to="/privacy">Privacy</Link>
          <Link className="hover:text-foreground" to="/contact">Contact</Link>
        </nav>
      </div>
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
