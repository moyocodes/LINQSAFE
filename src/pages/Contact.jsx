import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Loader2, Mail } from 'lucide-react'
import { api } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'
import { SITE } from '@/config'

export default function Contact() {
  useTitle('Contact')
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' }) // `website` is a honeypot
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState('')
  const doneRef = useRef(null)
  useEffect(() => { if (status === 'sent') doneRef.current?.focus() }, [status])
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    setStatus('sending')
    try {
      await api('/contact', { method: 'POST', body: form })
      setStatus('sent')
    } catch (err) {
      setError(err.message)
      setStatus('idle')
    }
  }

  return (
    <div className="container max-w-2xl py-16">
      <h1 className="text-4xl font-bold tracking-tight">Contact us</h1>
      <p className="mt-3 text-muted-foreground">Questions, feedback or a problem with your page? Send a message and we will get back to you.</p>
      <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
        <Mail className="size-4" aria-hidden="true" /> Or email <a className="font-medium text-foreground underline" href={`mailto:${SITE.email}`}>{SITE.email}</a>
      </p>

      <Card className="mt-8">
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            {status === 'sent' ? (
              <motion.div key="done" role="status" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-10 text-center">
                <CheckCircle2 className="mx-auto size-12 text-emerald-700" aria-hidden="true" />
                <h2 ref={doneRef} tabIndex={-1} className="mt-4 text-xl font-semibold outline-none">Message sent</h2>
                <p className="mt-1 text-muted-foreground">Thanks for reaching out. We will reply by email.</p>
              </motion.div>
            ) : (
              <motion.form key="form" onSubmit={submit} exit={{ opacity: 0 }} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" placeholder="Alex Rivera" autoComplete="name" required maxLength={100} value={form.name} onChange={set('name')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" placeholder="you@example.com" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={form.email} onChange={set('email')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea id="message" name="message" placeholder="How can we help? Tell us a bit about what you need." required minLength={10} maxLength={5000} value={form.message} onChange={set('message')} />
                </div>
                <input className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={form.website} onChange={set('website')} />
                {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
                <Button disabled={status === 'sending'} aria-busy={status === 'sending'}>
                  {status === 'sending' && <Loader2 className="animate-spin" aria-hidden="true" />}
                  Send message
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}
