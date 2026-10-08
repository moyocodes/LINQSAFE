import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { LogoMark } from '@/components/Logo'
import { TypeBadge } from '@/lib/linkTypes'

// ---------------------------------------------------------------------------
// The connector hub: your link in the middle, every platform plugged into it.
// Scroll drives it: platforms drift in from scattered → wires draw → clicks flow → live counts.
// ---------------------------------------------------------------------------
const STEPS = [
  { q: 'What is it?', title: 'One hub. Every platform.', text: 'Your page sits in the middle. Instagram, TikTok, your shop, your music: everything you make plugs into one link.' },
  { q: 'Why does it matter?', title: 'Attention is scattered.', text: 'Your audience is spread across apps. Each connection catches someone who would otherwise drift away.' },
  { q: 'How does it connect?', title: 'Everything flows through you.', text: 'Your video sends people to your shop, your shop to your WhatsApp, your WhatsApp back to your content. No dead ends.' },
  { q: 'What do you do next?', title: 'Plug in and share.', text: 'Share one URL, then watch live clicks on every connection. It takes about a minute.' },
]

// Stage is a 800×800 board; nodes sit on a ring around the hub and start scattered further out.
const C = 400
const R = 290
const NODES = [
  { type: 'instagram', label: 'Instagram', clicks: 128 },
  { type: 'tiktok', label: 'TikTok', clicks: 342 },
  { type: 'youtube', label: 'YouTube', clicks: 96 },
  { type: 'whatsapp', label: 'WhatsApp', clicks: 57 },
  { type: 'store', label: 'Shop', clicks: 211 },
  { type: 'music', label: 'Music', clicks: 74 },
  { type: 'x', label: 'X', clicks: 43 },
  { type: 'website', label: 'Portfolio', clicks: 88 },
].map((n, i, all) => {
  const a = -Math.PI / 2 + (i / all.length) * Math.PI * 2
  const scatter = 1.08 + ((i * 37) % 5) * 0.035 // deterministic "random" spread
  const twist = ((i % 2 ? 1 : -1) * 0.35)
  return {
    ...n,
    x: C + Math.cos(a) * R, y: C + Math.sin(a) * R,
    sx: C + Math.cos(a + twist) * R * scatter, sy: C + Math.sin(a + twist) * R * scatter,
    // gentle curve: control point pushed sideways from the midpoint
    cx: C + Math.cos(a + 0.35) * R * 0.55, cy: C + Math.sin(a + 0.35) * R * 0.55,
  }
})
const wire = (n) => `M${C},${C} Q${n.cx},${n.cy} ${n.x},${n.y}`
const pct = (v) => `${(v / 800) * 100}%`

function Counter({ to }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const c = animate(0, to, { duration: 1.2, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) })
    // keep ticking up a little, like live traffic
    const t = setInterval(() => setN((x) => x + (Math.random() < 0.5 ? 1 : 0)), 900)
    return () => { c.stop(); clearInterval(t) }
  }, [to])
  return <>{n.toLocaleString()}</>
}

function Wire({ n, i, p, flowing, inbound }) {
  const start = 0.04 + i * 0.035
  const length = useTransform(p, [start, start + 0.16], [0, 1])
  const glow = useTransform(p, [0.45, 0.55], [0, 1])
  const d = wire(n)
  return (
    <g>
      <motion.path d={d} fill="none" stroke="hsl(var(--foreground) / .16)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: length }} />
      {/* bright animated current once everything is connected */}
      <motion.path d={d} fill="none" stroke="url(#wire-g)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 14"
        className="hub-flow" style={{ opacity: glow, animationDelay: `${i * -0.2}s` }} />
      {flowing && [0, 1].map((k) => (
        <circle key={k} r={k ? 3.5 : 5} fill={k ? '#6CC3BA' : '#2B4FAF'} stroke="#fff" strokeWidth="1.5">
          <animateMotion dur={`${2.2 + (i % 3) * 0.4}s`} begin={`${i * 0.25 + k * 1.1}s`} repeatCount="indefinite" path={d}
            keyPoints={k && inbound ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear" />
        </circle>
      ))}
    </g>
  )
}

function Node({ n, i, p, live }) {
  const start = 0.04 + i * 0.035
  const x = useTransform(p, [0, start, start + 0.16], [pct(n.sx), pct(n.sx), pct(n.x)])
  const y = useTransform(p, [0, start, start + 0.16], [pct(n.sy), pct(n.sy), pct(n.y)])
  const opacity = useTransform(p, [0, start + 0.06], [0.35, 1])
  const scale = useTransform(p, [start, start + 0.16], [0.8, 1])
  return (
    <motion.div className="absolute z-10 -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y, opacity, scale }}>
      <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3 + (i % 3), repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 }}
        className="relative flex flex-col items-center gap-1.5">
        <span className="rounded-full bg-white/70 p-1 shadow-[0_10px_30px_-12px_hsl(20_35%_18%/.35)] ring-1 ring-white backdrop-blur-sm">
          <TypeBadge type={n.type} className="size-9 sm:size-11" />
        </span>
        <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.14em] text-foreground/60">{n.label}</span>
        <AnimatePresence>
          {live && (
            <motion.span initial={{ opacity: 0, y: 6, scale: 0.6 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }}
              transition={{ type: 'spring', stiffness: 380, damping: 18, delay: i * 0.06 }}
              className="absolute -right-6 -top-3 rounded-full bg-saffron px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-ink shadow-lg">
              +<Counter to={n.clicks} />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function Stage({ p, step }) {
  const tiltX = useSpring(0, { stiffness: 120, damping: 18 })
  const tiltY = useSpring(0, { stiffness: 120, damping: 18 })
  const hubScale = useTransform(p, [0, 0.08], [0.6, 1])
  const flowing = step >= 2
  return (
    <motion.div
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        tiltY.set(((e.clientX - r.left) / r.width - 0.5) * 10)
        tiltX.set(-((e.clientY - r.top) / r.height - 0.5) * 10)
      }}
      onPointerLeave={() => { tiltX.set(0); tiltY.set(0) }}
      style={{ rotateX: tiltX, rotateY: tiltY, transformPerspective: 1000 }}
      className="relative aspect-square w-full"
    >
      <svg viewBox="0 0 800 800" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="wire-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2B4FAF" /><stop offset=".5" stopColor="#F2A07E" /><stop offset="1" stopColor="#6CC3BA" />
          </linearGradient>
          <radialGradient id="hub-glow"><stop offset="0" stopColor="#ffffff" stopOpacity=".9" /><stop offset="1" stopColor="#2B4FAF" stopOpacity="0" /></radialGradient>
        </defs>
        <circle cx={C} cy={C} r="230" fill="url(#hub-glow)" />
        {/* slow orbit rings */}
        {[R, R * 0.62, R * 1.22].map((r, k) => (
          <motion.circle key={r} cx={C} cy={C} r={r} fill="none" stroke="hsl(var(--foreground) / .12)" strokeDasharray={k === 1 ? '2 6' : '1 10'}
            animate={{ rotate: k % 2 ? -360 : 360 }} transition={{ duration: 80 + k * 30, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '400px 400px', transformBox: 'view-box' }} />
        ))}
        {NODES.map((n, i) => <Wire key={n.type} n={n} i={i} p={p} flowing={flowing} inbound={step >= 2} />)}
      </svg>

      {/* the hub */}
      <motion.div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2" style={{ scale: hubScale }}>
        {[0, 1, 2].map((k) => (
          <motion.span key={k} aria-hidden="true" className="absolute inset-0 rounded-[28%] border border-cobalt/40"
            animate={{ scale: [1, 2.4], opacity: [0.6, 0] }} transition={{ duration: 3, repeat: Infinity, delay: k, ease: 'easeOut' }} />
        ))}
        <motion.div animate={step >= 2 ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={{ duration: 1.2, repeat: Infinity }}
          className="relative rounded-[28%] shadow-[0_20px_50px_-10px_rgb(43_79_175/.6)]">
          <LogoMark className="size-20 sm:size-24" />
        </motion.div>
        <AnimatePresence mode="wait">
          <motion.span key={step >= 3 ? 'url' : 'hub'} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            className="absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-full bg-white px-3 py-1 font-mono text-[11px] text-ink shadow-md">
            {step >= 3 ? 'linqsafe.com/you' : 'your link'}
          </motion.span>
        </AnimatePresence>
      </motion.div>

      {NODES.map((n, i) => <Node key={n.type} n={n} i={i} p={p} live={step >= 3} />)}
    </motion.div>
  )
}

function StepCard({ s, i, cta }) {
  return (
    <div>
      <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="font-semibold text-accent">{String(i + 1).padStart(2, '0')}</span>
        <span className="h-px w-6 bg-foreground/20" aria-hidden="true" />
        {s.q}
      </p>
      <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">{s.title}</h2>
      <p className="mt-5 max-w-md text-lg leading-8 text-muted-foreground">{s.text}</p>
      <div className="mt-7 flex gap-1.5" aria-hidden="true">
        {STEPS.map((_, j) => <span key={j} className={`h-1 rounded-full transition-all duration-500 ${j === i ? 'w-8 bg-accent' : 'w-2 bg-foreground/15'}`} />)}
      </div>
      {cta && (
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/signup">Create your page</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/login">Log in</Link></Button>
        </div>
      )}
    </div>
  )
}

// No card: the hub sits on the page itself, over a soft pastel glow that fades out with no edges.
const Panel = ({ className = '', children }) => (
  <div className={`relative ${className}`}>
    <div aria-hidden="true" className="pointer-events-none absolute -inset-10 -z-10 opacity-80 blur-2xl [background:radial-gradient(closest-side_at_60%_35%,rgb(242_160_126/.30),transparent),radial-gradient(closest-side_at_35%_70%,rgb(147_172_207/.45),transparent),radial-gradient(closest-side_at_50%_50%,rgb(108_195_186/.18),transparent)]" />
    {children}
  </div>
)

export default function HubStory() {
  const reduced = useReducedMotion()
  const section = useRef(null)
  const { scrollYProgress } = useScroll({ target: section, offset: ['start 65px', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 140, damping: 26, restDelta: 0.001 })
  const full = useMotionValue(1)
  const p = reduced ? full : smooth
  const [step, setStep] = useState(reduced ? 3 : 0)
  useMotionValueEvent(smooth, 'change', (v) => { if (!reduced) setStep(Math.min(3, Math.floor(v * 4))) })
  const hint = useTransform(smooth, [0, 0.04], [1, 0])

  if (reduced) {
    return (
      <section aria-label="How the connector hub works" className="container py-16">
        <Panel><div className="relative mx-auto max-w-lg"><Stage p={p} step={3} /></div></Panel>
        <div className="mt-10 grid gap-10 sm:grid-cols-2">{STEPS.map((s, i) => <StepCard key={s.q} s={s} i={i} cta={i === STEPS.length - 1} />)}</div>
      </section>
    )
  }

  return (
    <section ref={section} aria-label="How the connector hub works" className="relative h-[300vh]">
      <div className="sticky top-[65px] flex h-[calc(100svh-65px)] items-center">
        <div className="container grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-12">
          <div className="order-2 min-h-[16rem] md:order-1">
            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, y: 24, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -24, filter: 'blur(6px)' }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} aria-live="polite">
                <StepCard s={STEPS[step]} i={step} cta={step === STEPS.length - 1} />
              </motion.div>
            </AnimatePresence>
          </div>
          <Panel className="order-1 md:order-2">
            <div className="relative mx-auto w-full max-w-[min(100%,42svh)] p-4 sm:p-8 md:max-w-[min(100%,66svh)]">
              <Stage p={p} step={step} />
            </div>
            <motion.p style={{ opacity: hint }} className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.2em] text-foreground/50">
              Scroll to connect ↓
            </motion.p>
            <div className="absolute inset-x-[20%] bottom-0 h-1 overflow-hidden rounded-full bg-foreground/10">
              <motion.div style={{ scaleX: smooth }} className="h-full origin-left bg-gradient-to-r from-accent via-rose to-lilac" />
            </div>
          </Panel>
        </div>
      </div>
    </section>
  )
}
