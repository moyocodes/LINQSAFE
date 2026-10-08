import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Loader2, X } from 'lucide-react'
import { api } from '@/api'
import { SITE } from '@/config'

// "Claim your link" box: type a name, see if it's free, and go straight to sign-up with it filled in.
export default function ClaimLink({ className = '' }) {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [state, setState] = useState(null) // null | 'checking' | { available, reason }
  useEffect(() => {
    if (name.length < 3) { setState(name ? { available: false, reason: 'At least 3 characters' } : null); return }
    setState('checking')
    const t = setTimeout(() => api(`/username/${encodeURIComponent(name)}`).then(setState).catch(() => setState(null)), 350)
    return () => clearTimeout(t)
  }, [name])
  const ok = state && state !== 'checking' && state.available
  const submit = (e) => { e.preventDefault(); navigate(`/signup${name ? `?u=${encodeURIComponent(name)}` : ''}`) }

  return (
    <form onSubmit={submit} className={className} aria-label="Claim your link">
      <label htmlFor="claim" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Claim your link</label>
      <div className={`flex items-center gap-1 rounded-xl border bg-card p-1 pl-3 shadow-sm transition-colors focus-within:border-accent ${state && state !== 'checking' && !state.available ? 'border-destructive/60' : ''}`}>
        <span className="shrink-0 text-xs text-muted-foreground">{SITE.domain}/</span>
        <input id="claim" value={name} onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/gi, '').slice(0, 32).toLowerCase())}
          placeholder="yourname" autoComplete="off" spellCheck={false} aria-describedby="claim-status"
          className="min-w-0 flex-1 bg-transparent py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/70" />
        <motion.button whileTap={{ scale: 0.92 }} type="submit" aria-label="Claim this link and sign up"
          className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${ok ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'}`}>
          <ArrowRight className="size-4" />
        </motion.button>
      </div>
      <p id="claim-status" aria-live="polite" className="mt-1.5 flex h-4 items-center gap-1 text-[11px]">
        <AnimatePresence mode="wait" initial={false}>
          {state === 'checking' ? <motion.span key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Checking…</motion.span>
            : state?.available ? <motion.span key="y" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 font-medium text-emerald-700"><Check className="size-3" /> It's yours. Tap → to sign up</motion.span>
            : state ? <motion.span key="n" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-destructive"><X className="size-3" /> {state.reason}</motion.span>
            : <motion.span key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground">Free to start · takes a minute</motion.span>}
        </AnimatePresence>
      </p>
    </form>
  )
}
