import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { api, isSignedIn, setSignedIn } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { useTitle } from '@/lib/useTitle'
import { SITE } from '@/config'
import { IS_ADMIN_HOST } from '@/lib/stage'

export default function Auth({ mode }) {
  const isLogin = mode === 'login'
  useTitle(isLogin ? 'Log in' : 'Sign up')
  const [form, setForm] = useState(() => ({ username: new URLSearchParams(location.search).get('u')?.replace(/[^a-z0-9_]/gi, '').slice(0, 32) || '', email: '', password: '' }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [agree, setAgree] = useState(false)
  const navigate = useNavigate()
  const query = new URLSearchParams(location.search)
  const expired = isLogin && query.get('expired') === '1'
  // Back to the page they were on when the session ran out (same-site paths only).
  const next = /^\/(?![/\\])/.test(query.get('next') || '') ? query.get('next') : null

  // Already signed in: log in / sign up just take you to your dashboard until you log out.
  // (The session is checked first, so an expired one still shows the form.)
  useEffect(() => {
    if (!isSignedIn()) return
    api('/me').then(() => navigate(next || (IS_ADMIN_HOST ? '/' : '/admin'), { replace: true })).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api(`/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: isLogin ? { username: form.username, password: form.password } : form })
      setSignedIn(true)
      navigate(next || (IS_ADMIN_HOST ? '/' : '/admin'))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-hero -mt-16 pt-16">
      <div className="container grid min-h-[calc(100vh-8rem)] place-items-center py-8">
        <motion.div initial={{ opacity: 0, y: 24, rotate: -0.6 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative grid w-full max-w-4xl overflow-hidden rounded-md lg:grid-cols-[1fr_1.05fr]">
          {/* A second sheet peeking out underneath, so the card reads as paper, not a UI panel. */}
          <aside aria-hidden="true" className="relative hidden flex-col justify-between overflow-hidden bg-cobalt p-9 text-white lg:flex">
            <div className="absolute -right-16 -top-16 size-64 rounded-full bg-saffron/80 blur-2xl" />
            <div className="absolute -bottom-20 -left-10 size-72 rounded-full bg-lilac/60 blur-3xl" />
            <div className="absolute bottom-24 right-6 size-40 rounded-full bg-rose/70 blur-2xl" />
            <p className="eyebrow relative !text-white/70">{SITE.domain}</p>
            <div className="relative">
              <p className="font-display text-4xl font-semibold leading-tight">One link.<br />Every place<br />you show up.</p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 font-mono text-sm backdrop-blur">
                {SITE.domain}/<span className="font-semibold text-saffron-soft">{form.username || 'yourname'}</span>
              </motion.div>
            </div>
          </aside>
          <div className="paper px-7 py-7 sm:px-9">
            {/* Both forms share one card; each keeps its own URL (/login, /signup) so links and back-button work. */}
            <nav aria-label="Account" className="flex gap-6 border-b border-foreground/10">
              {[['/login', 'Log in', true], ['/signup', 'Create account', false]].map(([to, label, forLogin]) => (
                <Link key={to} to={to} replace aria-current={isLogin === forLogin ? 'page' : undefined}
                  className={`relative -mb-px pb-2.5 text-sm transition-colors ${isLogin === forLogin ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  {label}
                  {isLogin === forLogin && <motion.span layoutId="auth-tab" className="absolute inset-x-0 -bottom-px h-[2px] bg-accent" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
                </Link>
              ))}
            </nav>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={mode} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                <h1 className="mt-5 font-serif text-[2.2rem] font-medium leading-[0.95] tracking-tight">
                  {isLogin ? <>Welcome <em className="text-accent">back</em></> : <>Make it <em className="text-accent">yours</em></>}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{isLogin ? 'Log in to manage your page.' : 'Pick a username. It becomes your link.'}</p>
                {expired && <p role="status" className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">Your session expired. Log in again to carry on.</p>}

                <form onSubmit={submit} className="mt-5 space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="username" className="label-form">{isLogin ? 'Username or email' : 'Username'}</Label>
                    <Input id="username" name="username" placeholder={isLogin ? 'your_username or you@gmail.com' : 'moyosore_james'} autoFocus autoComplete="username" required value={form.username}
                      autoCapitalize="none" autoCorrect="off" spellCheck={false}
                      pattern={isLogin ? undefined : '[A-Za-z0-9_]{3,32}'}
                      title={isLogin ? undefined : '3 to 32 letters, numbers or underscores'}
                      aria-invalid={!!error} aria-describedby={[!isLogin && 'username-hint', error && 'auth-error'].filter(Boolean).join(' ') || undefined}
                      onChange={(e) => setForm({ ...form, username: e.target.value })} />
                    {!isLogin && <p id="username-hint" className="text-xs text-muted-foreground">{SITE.domain}/<span className="font-medium text-foreground">{form.username || 'yourname'}</span> · 3–32 letters, numbers or _</p>}
                  </div>
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="label-form">Email</Label>
                      <Input id="email" name="email" type="email" placeholder="you@gmail.com" required autoComplete="email" value={form.email}
                        autoCapitalize="none" spellCheck={false}
                        onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <Label htmlFor="password" className="label-form">Password</Label>
                      {isLogin && <Link to="/forgot-password" className="font-serif text-sm italic text-muted-foreground underline-offset-4 hover:text-accent hover:underline">Forgot it?</Link>}
                    </div>
                    <PasswordInput id="password" name="password" placeholder={isLogin ? 'Your password' : 'At least 6 characters'} required minLength={isLogin ? undefined : 6}
                      autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password}
                      aria-invalid={!!error} aria-describedby={[error && 'auth-error'].filter(Boolean).join(' ') || undefined}
                      onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                  {!isLogin && (
                    <p className="text-xs text-muted-foreground">Your username, name, bio and links are public. Your email and password never are.</p>
                  )}
                  {!isLogin && (
                    <label className="flex items-start gap-3 text-sm text-muted-foreground">
                      <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded-sm accent-[hsl(var(--accent))]" />
                      <span>I agree to the <Link className="text-foreground underline underline-offset-2" to="/terms" target="_blank">Terms</Link> and <Link className="text-foreground underline underline-offset-2" to="/privacy" target="_blank">Privacy Policy</Link>.</span>
                    </label>
                  )}
                  {error && <p id="auth-error" role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                  <Button className="h-12 w-full text-[15px]" disabled={busy} aria-busy={busy}>
                    {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                    {isLogin ? 'Log in' : 'Create my page'} <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                  </Button>
                </form>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  {isLogin ? 'New here? ' : 'Already have a page? '}
                  <Link className="font-serif text-base italic text-foreground underline decoration-accent/50 underline-offset-4 hover:decoration-accent" to={isLogin ? '/signup' : '/login'} replace>
                    {isLogin ? 'Create one' : 'Log in'}
                  </Link>
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
