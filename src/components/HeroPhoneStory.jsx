import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Copy, Plus } from 'lucide-react'
import { TypeBadge } from '@/lib/linkTypes'
import { SITE } from '@/config'

// A looping three-step story inside the hero phone: add a link → your page builds → paste it in your bio.
const STEPS = ['Add links', 'Page builds', 'Share it']
const SCENE_MS = 3600
const URL_TEXT = 'instagram.com/moyosore'

function useTyped(text, active, speed = 70) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return setN(0)
    const t = setInterval(() => setN((v) => (v < text.length ? v + 1 : v)), speed)
    return () => clearInterval(t)
  }, [active, text, speed])
  return text.slice(0, n)
}

function AddScene() {
  const typed = useTyped(URL_TEXT, true)
  const done = typed.length === URL_TEXT.length
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dashboard</p>
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <p className="text-[10px] text-muted-foreground">Title</p>
        <p className="text-sm font-medium">My Instagram</p>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <p className="text-[10px] text-muted-foreground">URL</p>
        <p className="text-sm font-medium">
          https://{typed}
          <motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground" />
        </p>
      </div>
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="flex items-center gap-2 text-xs">
            <TypeBadge type="instagram" className="size-6" /> <span className="font-medium">Instagram detected</span>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={done ? { scale: [1, 0.94, 1] } : {}} transition={{ delay: 0.6, duration: 0.3 }}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Plus className="size-4" /> Add link
      </motion.div>
    </div>
  )
}

function PageScene() {
  const links = ['My latest video', 'Shop my picks', 'Newsletter']
  return (
    <div className="text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
        className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground ring-4 ring-accent/20">M</motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mt-2 font-semibold">Moyosore James</motion.p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Design · Travel · Food</motion.p>
      <div className="mt-3 flex justify-center gap-2">
        {['instagram', 'tiktok', 'youtube'].map((t, i) => (
          <motion.span key={t} initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.4 + i * 0.1, type: 'spring', stiffness: 400, damping: 14 }}>
            <TypeBadge type={t} className="size-8" />
          </motion.span>
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {links.map((l, i) => (
          <motion.div key={l} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 + i * 0.15 }}
            className="rounded-xl border border-white/60 bg-white/80 px-4 py-2.5 text-sm font-medium shadow-sm">{l}</motion.div>
        ))}
      </div>
    </div>
  )
}

function ShareScene() {
  const pasted = useTyped(`${SITE.domain}/moyosore`, true, 45)
  const [copied, setCopied] = useState(false)
  useEffect(() => { const t = setTimeout(() => setCopied(true), 150); return () => clearTimeout(t) }, [])
  return (
    <div className="space-y-3">
      <AnimatePresence>
        {copied && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-fit items-center gap-1.5 rounded-full bg-foreground px-3 py-1 text-[11px] font-medium text-background">
            <Copy className="size-3" /> Link copied
          </motion.div>
        )}
      </AnimatePresence>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Edit profile · Instagram</p>
      <div className="flex items-center gap-3">
        <div className="size-12 rounded-full bg-gradient-to-tr from-amber-300 via-rose-400 to-fuchsia-500 p-0.5"><div className="size-full rounded-full bg-primary" /></div>
        <div className="text-xs"><p className="font-semibold">moyosore.james</p><p className="text-muted-foreground">Designer & creator</p></div>
      </div>
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <p className="text-[10px] text-muted-foreground">Links</p>
        <p className="text-sm font-medium text-sky-700">{pasted}<motion.span animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="ml-px inline-block h-4 w-px translate-y-0.5 bg-foreground" /></p>
      </div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.2 }}
        className="flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 py-2.5 text-sm font-semibold text-white">
        <Check className="size-4" /> Saved to bio
      </motion.div>
    </div>
  )
}

const SCENES = [AddScene, PageScene, ShareScene]

export default function HeroPhoneStory() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(reduce ? 1 : 0)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setStep((s) => (s + 1) % SCENES.length), SCENE_MS)
    return () => clearInterval(t)
  }, [reduce])
  const Scene = SCENES[step]

  return (
    <div className="flex min-h-[25rem] flex-col">
      {/* step tabs double as manual controls */}
      <div className="mb-4 flex gap-1.5" role="tablist" aria-label="How it works">
        {STEPS.map((label, i) => (
          <button key={label} type="button" role="tab" aria-selected={i === step} onClick={() => setStep(i)}
            className="flex-1 text-left">
            <span className="block h-1 overflow-hidden rounded-full bg-foreground/10">
              {i === step && (
                <motion.span key={`${step}-bar`} className="block h-full bg-foreground" initial={{ width: reduce ? '100%' : 0 }} animate={{ width: '100%' }} transition={{ duration: SCENE_MS / 1000, ease: 'linear' }} />
              )}
              {i < step && <span className="block h-full bg-foreground" />}
            </span>
            <span className={`mt-1 block text-[10px] font-semibold ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>{i + 1}. {label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={step} className="flex-1"
          initial={{ opacity: 0, x: 24, filter: 'blur(4px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, x: -24, filter: 'blur(4px)' }}
          transition={{ duration: 0.35 }}>
          <Scene />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
