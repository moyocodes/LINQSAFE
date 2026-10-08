import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Check, Loader2, MousePointer2, X } from 'lucide-react'
import { api } from '@/api'
import { SITE } from '@/config'

// Names the ghost cursor "types" while the box is idle.
const DEMO = ['amara', 'tobi_eats', 'kemistyles', 'yourname']

// Types and deletes demo names, one character at a time, until the visitor takes over.
function useGhostTyping(active) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (!active) { setText(''); return }
    let word = 0, i = 0, dir = 1, t
    const tick = () => {
      const w = DEMO[word]
      i += dir
      setText(w.slice(0, i))
      if (dir === 1 && i === w.length) { dir = -1; t = setTimeout(tick, 1400); return }
      if (dir === -1 && i === 0) { dir = 1; word = (word + 1) % DEMO.length; t = setTimeout(tick, 350); return }
      t = setTimeout(tick, dir === 1 ? 110 : 45)
    }
    t = setTimeout(tick, 900)
    return () => clearTimeout(t)
  }, [active])
  return text
}

// "Claim your link" box: type a name, see if it's free, and go straight to sign-up with it filled in.
export default function ClaimLink({ className = '' }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const input = useRef(null)
  const [name, setName] = useState('')
  const [focused, setFocused] = useState(false)
  const [state, setState] = useState(null) // null | 'checking' | { available, reason }
  const idle = !reduce && !focused && !name
  const ghost = useGhostTyping(idle)

  useEffect(() => {
    if (name.length < 3) { setState(name ? { available: false, reason: 'At least 3 characters' } : null); return }
    setState('checking')
    const t = setTimeout(() => api(`/username/${encodeURIComponent(name)}`).then(setState).catch(() => setState(null)), 350)
    return () => clearTimeout(t)
  }, [name])
  const ok = state && state !== 'checking' && state.available
  const bad = state && state !== 'checking' && !state.available
  const submit = (e) => {
    e.preventDefault()
    if (!name) return input.current?.focus()
    navigate(`/signup?u=${encodeURIComponent(name)}`)
  }

  return (
    <form onSubmit={submit} className={`relative ${className}`} aria-label="Claim your link">
      <label htmlFor="claim" className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        <span className="relative flex size-1.5"><span className="absolute inset-0 animate-ping rounded-full bg-accent" /><span className="relative size-1.5 rounded-full bg-accent" /></span>
        Claim your link, it's free
      </label>

      <motion.div
        animate={idle ? { boxShadow: ['0 0 0 0 rgb(43 79 175 / 0)', '0 0 0 6px rgb(43 79 175 / .18)', '0 0 0 0 rgb(43 79 175 / 0)'] } : { boxShadow: '0 0 0 0 rgb(43 79 175 / 0)' }}
        transition={idle ? { duration: 2.2, repeat: Infinity } : { duration: 0.2 }}
        onClick={() => input.current?.focus()}
        className={`relative flex cursor-text items-center gap-1 rounded-xl border-2 bg-card p-1 pl-3 transition-colors ${bad ? 'border-destructive/60' : focused || ok ? 'border-accent' : 'border-accent/40'}`}>
        <span className="shrink-0 text-xs text-muted-foreground">{SITE.domain}/</span>
        <span className="relative min-w-0 flex-1">
          <input ref={input} id="claim" value={name} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            onChange={(e) => setName(e.target.value.replace(/[^a-z0-9_]/gi, '').slice(0, 32).toLowerCase())}
            placeholder={idle ? '' : 'type your username here'} autoComplete="off" spellCheck={false} aria-describedby="claim-status"
            className="w-full bg-transparent py-1.5 text-sm font-semibold outline-none placeholder:font-normal placeholder:text-muted-foreground/70" />
          {/* ghost typing with a blinking caret while idle */}
          {idle && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-sm font-semibold text-foreground/45">
              {ghost}
              <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.55, repeat: Infinity, repeatType: 'reverse' }}
                className="ml-px inline-block h-4 w-[2px] rounded bg-accent" />
            </span>
          )}
        </span>
        <motion.button whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.06 }} type="submit" aria-label="Claim this link and sign up"
          animate={idle ? { x: [0, 3, 0] } : { x: 0 }} transition={idle ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${ok ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'}`}>
          <ArrowRight className="size-4" />
        </motion.button>

        {/* a pointer that glides in and taps the box, so it's obvious it can be used */}
        <AnimatePresence>
          {idle && (
            <motion.span key="pointer" aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 z-10 text-ink drop-shadow-[0_2px_3px_rgb(0_0_0/.3)]"
              initial={{ opacity: 0, x: 70, y: 46 }}
              animate={{ opacity: [0, 1, 1, 1, 1, 0], x: [70, 70, 4, 4, 4, 4], y: [46, 46, 6, 6, 6, 6], scale: [1, 1, 1, 0.8, 1, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 4.2, times: [0, 0.1, 0.45, 0.52, 0.6, 1], repeat: Infinity, repeatDelay: 1.2, ease: 'easeInOut' }}>
              <MousePointer2 className="size-5 fill-paper" strokeWidth={2} />
              <span className="absolute left-4 top-4 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 font-sans text-[11px] font-semibold text-paper shadow-lg">
                Type your username here
              </span>
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      <p id="claim-status" aria-live="polite" className="mt-1.5 flex h-4 items-center gap-1 text-[11px]">
        <AnimatePresence mode="wait" initial={false}>
          {state === 'checking' ? <motion.span key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Checking…</motion.span>
            : state?.available ? <motion.span key="y" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 font-medium text-emerald-700"><Check className="size-3" /> It's yours. Tap → to sign up</motion.span>
            : state ? <motion.span key="n" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1 text-destructive"><X className="size-3" /> {state.reason}</motion.span>
            : <motion.span key="e" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground">Tap the box and type a name · takes a minute</motion.span>}
        </AnimatePresence>
      </p>
    </form>
  )
}
