import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { api, setToken } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'

export default function Auth({ mode }) {
  const isLogin = mode === 'login'
  useTitle(isLogin ? 'Log in' : 'Sign up')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [agree, setAgree] = useState(false)
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { token } = await api(`/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body: isLogin ? { username: form.username, password: form.password } : form })
      setToken(token)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-hero">
      <div className="container grid min-h-[calc(100vh-8rem)] place-items-center py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card>
            <CardHeader>
              <CardTitle>{isLogin ? 'Welcome back' : 'Create your account'}</CardTitle>
              <CardDescription>{isLogin ? 'Log in to manage your links.' : 'Pick a username to get your link.'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" placeholder={isLogin ? 'your_username' : 'alex_rivera'}  autoFocus autoComplete="username" required value={form.username}
                    autoCapitalize="none" autoCorrect="off" spellCheck={false}
                    pattern={isLogin ? undefined : '[A-Za-z0-9_]{3,32}'}
                    title={isLogin ? undefined : '3 to 32 letters, numbers or underscores'}
                    aria-invalid={!!error} aria-describedby={[!isLogin && 'username-hint', error && 'auth-error'].filter(Boolean).join(' ') || undefined}
                    onChange={(e) => setForm({ ...form, username: e.target.value })} />
                  {!isLogin && <p id="username-hint" className="text-xs text-muted-foreground">3–32 letters, numbers or underscores. This becomes your link.</p>}
                </div>
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="you@example.com" required autoComplete="email" value={form.email}
                      autoCapitalize="none" spellCheck={false}
                      onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <PasswordInput id="password" name="password" placeholder={isLogin ? 'Your password' : 'At least 6 characters'} required minLength={isLogin ? undefined : 6}
                    autoComplete={isLogin ? 'current-password' : 'new-password'} value={form.password}
                    aria-invalid={!!error} aria-describedby={[!isLogin && 'password-hint', error && 'auth-error'].filter(Boolean).join(' ') || undefined}
                    onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  {!isLogin && <p id="password-hint" className="text-xs text-muted-foreground">At least 6 characters.</p>}
                </div>
                {!isLogin && (
                  <label className="flex items-start gap-3 text-sm text-muted-foreground">
                    <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[hsl(var(--primary))]" />
                    <span>I agree to the <Link className="text-foreground underline" to="/terms" target="_blank">Terms</Link> and <Link className="text-foreground underline" to="/privacy" target="_blank">Privacy Policy</Link>.</span>
                  </label>
                )}
                {error && <p id="auth-error" role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                <Button className="w-full" disabled={busy} aria-busy={busy}>
                  {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
                  {isLogin ? 'Log in' : 'Create account'}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {isLogin ? 'New here? ' : 'Already have an account? '}
                <Link className="font-semibold text-foreground underline underline-offset-4" to={isLogin ? '/signup' : '/login'}>
                  {isLogin ? 'Sign up' : 'Log in'}
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
