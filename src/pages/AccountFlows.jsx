import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Crown, KeyRound, Loader2, MailCheck, XCircle } from 'lucide-react'
import { api, setSignedIn } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'

function Shell({ children }) {
  return (
    <div className="bg-hero -mt-16 pt-16">
      <div className="container grid min-h-[calc(100vh-8rem)] place-items-center py-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">{children}</motion.div>
      </div>
    </div>
  )
}

export function VerifyEmail() {
  useTitle('Verify email')
  const [params] = useSearchParams()
  const [state, setState] = useState('working')
  const [error, setError] = useState('')
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return // StrictMode runs effects twice; the token is single-use
    ran.current = true
    api('/verify-email', { method: 'POST', body: { token: params.get('token') } })
      .then(() => setState('done'))
      .catch((e) => { setError(e.message); setState('error') })
  }, [params])
  return (
    <Shell>
      <Card>
        <CardContent className="py-10 text-center" role="status">
          {state === 'working' && <Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" aria-label="Verifying" />}
          {state === 'done' && (<>
            <CheckCircle2 className="mx-auto size-12 text-emerald-700" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">Email verified</h1>
            <p className="mt-1 text-muted-foreground">Thanks! Your account is all set.</p>
            <Button asChild className="mt-6"><Link to="/admin">Go to dashboard</Link></Button>
          </>)}
          {state === 'error' && (<>
            <XCircle className="mx-auto size-12 text-destructive" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">Couldn't verify</h1>
            <p className="mt-1 text-muted-foreground">{error}</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/admin">Go to dashboard</Link></Button>
          </>)}
        </CardContent>
      </Card>
    </Shell>
  )
}

export function ForgotPassword() {
  useTitle('Forgot password')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/password/forgot', { method: 'POST', body: { email } })
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="size-5" aria-hidden="true" /> Forgot your password?</CardTitle>
          <CardDescription>Enter your account email and we'll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div role="status" className="space-y-3 text-center">
              <MailCheck className="mx-auto size-10 text-emerald-700" aria-hidden="true" />
              <p className="text-sm">If an account uses <strong>{email}</strong>, a reset link is on its way. It works for 1 hour.</p>
              <Link to="/login" className="text-sm font-semibold underline underline-offset-4">Back to log in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@gmail.com" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <Button className="w-full" disabled={busy} aria-busy={busy}>{busy && <Loader2 className="animate-spin" aria-hidden="true" />} Send reset link</Button>
              <p className="text-center text-sm"><Link to="/login" className="text-muted-foreground underline underline-offset-4 hover:text-foreground">Back to log in</Link></p>
            </form>
          )}
        </CardContent>
      </Card>
    </Shell>
  )
}

export function ResetPassword() {
  useTitle('Choose a new password')
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/password/reset', { method: 'POST', body: { token: params.get('token'), password } })
      setSignedIn(true)
      navigate('/admin')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>This also signs you out on every other device.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput id="password" required minLength={6} autoComplete="new-password" placeholder="At least 6 characters" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error} <Link to="/forgot-password" className="underline">Request a new link</Link></p>}
            <Button className="w-full" disabled={busy} aria-busy={busy}>{busy && <Loader2 className="animate-spin" aria-hidden="true" />} Save password</Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  )
}

// Paystack sends the buyer back here with ?reference=… ; we confirm it server-side before granting Pro.
export function BillingCallback() {
  useTitle('Confirming payment')
  const [params] = useSearchParams()
  const [state, setState] = useState('working')
  const [info, setInfo] = useState('')
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return
    ran.current = true
    api('/billing/verify', { method: 'POST', body: { reference: params.get('reference') || params.get('trxref') } })
      .then((r) => { setInfo(r); setState('done') })
      .catch((e) => { setInfo(e.message); setState('error') })
  }, [params])
  return (
    <Shell>
      <Card>
        <CardContent className="py-10 text-center" role="status">
          {state === 'working' && (<><Loader2 className="mx-auto size-10 animate-spin text-muted-foreground" aria-hidden="true" /><p className="mt-4 text-sm text-muted-foreground">Confirming your payment with Paystack…</p></>)}
          {state === 'done' && (<>
            <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}>
              <Crown className="mx-auto size-12 text-accent" aria-hidden="true" />
            </motion.div>
            <h1 className="mt-4 text-xl font-semibold">{info.name} unlocked</h1>
            <p className="mt-1 text-muted-foreground">Thank you! {info.until ? `It's active until ${new Date(info.until).toLocaleDateString()}.` : "It's active."}</p>
            <Button asChild className="mt-6"><Link to="/admin">Go to dashboard</Link></Button>
          </>)}
          {state === 'error' && (<>
            <XCircle className="mx-auto size-12 text-destructive" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-semibold">We couldn't confirm that payment</h1>
            <p className="mt-1 text-muted-foreground">{info}. If you were charged, the feature will switch on automatically within a few minutes.</p>
            <Button asChild variant="outline" className="mt-6"><Link to="/admin">Go to dashboard</Link></Button>
          </>)}
        </CardContent>
      </Card>
    </Shell>
  )
}
