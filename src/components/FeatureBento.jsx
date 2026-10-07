import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BarChart3, Check, GripVertical, Palette, QrCode, Share2, Sparkles, Zap } from 'lucide-react'
import { fadeUp, stagger } from '@/lib/motion'
import { TypeBadge } from '@/lib/linkTypes'
import { LogoMark } from '@/components/Logo'
import { SITE } from '@/config'

// Bento-style feature grid: mixed card sizes, each with a small live demo instead of a static icon.
function Tile({ className = '', tint = 'from-card', eyebrow, icon: Icon, title, text, children }) {
  // Cards fade into the page: a hairline border and fill that dissolve toward the bottom, plus a soft
  // spotlight that follows the cursor. No drop shadow, so the grid reads as part of the background.
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    e.currentTarget.style.setProperty('--x', `${e.clientX - r.left}px`)
    e.currentTarget.style.setProperty('--y', `${e.clientY - r.top}px`)
  }
  return (
    <motion.article variants={fadeUp} onPointerMove={onMove} className={`group relative flex flex-col rounded-3xl p-6 ${className}`}>
      <div aria-hidden="true" className={`absolute inset-0 rounded-3xl bg-gradient-to-b ${tint} to-transparent [mask-image:linear-gradient(to_bottom,black_40%,transparent)]`} />
      <div aria-hidden="true" className="border-blend opacity-70 transition-opacity duration-500 group-hover:opacity-100" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-500 [background:radial-gradient(320px_circle_at_var(--x)_var(--y),hsl(var(--accent)/.35),transparent_70%)] group-hover:opacity-100" />
      <div className="relative flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" /> {eyebrow}
        </span>
        <ArrowUpRight className="size-4 -translate-x-1 translate-y-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100" aria-hidden="true" />
      </div>
      <h3 className="relative mt-3 text-xl font-bold">{title}</h3>
      <p className="relative mt-1.5 max-w-prose text-sm text-muted-foreground">{text}</p>
      <div className="relative mt-6 flex flex-1 items-end" aria-hidden="true">{children}</div>
    </motion.article>
  )
}

function StepsDemo() {
  const steps = ['Pick a username', 'Add your links', 'Share & go live']
  return (
    <ol className="grid w-full gap-3 sm:grid-cols-3">
      {steps.map((s, i) => (
        <motion.li
          key={s} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.2 + i * 0.25 }}
          className="flex items-center gap-3 rounded-2xl bg-muted/70 p-3 text-sm font-medium"
        >
          <motion.span
            initial={{ scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.45 + i * 0.25, type: 'spring', stiffness: 400, damping: 14 }}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            {i === 2 ? <Check className="size-4" /> : i + 1}
          </motion.span>
          {s}
        </motion.li>
      ))}
    </ol>
  )
}

// Fake "live" analytics: new bar heights every 2 seconds, with a click counter ticking up.
const nextBars = () => Array.from({ length: 7 }, () => 30 + Math.round(Math.random() * 66))
function BarsDemo() {
  const reduce = useReducedMotion()
  const [bars, setBars] = useState([38, 62, 45, 80, 58, 96, 72])
  const [clicks, setClicks] = useState(1284)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => {
      setBars(nextBars())
      setClicks((c) => c + 3 + Math.round(Math.random() * 14))
    }, 2000)
    return () => clearInterval(t)
  }, [reduce])
  const top = bars.indexOf(Math.max(...bars))
  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between">
        <motion.span key={clicks} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-mono text-lg font-semibold tabular-nums text-foreground">
          {clicks.toLocaleString()}
        </motion.span>
        <span className="eyebrow flex items-center gap-1.5"><span className="size-1.5 animate-pulse rounded-full bg-saffron" />live clicks</span>
      </div>
      <div className="flex h-24 items-end gap-2">
        {bars.map((h, i) => (
          <motion.span
            key={i} initial={{ height: 0 }} animate={{ height: `${h}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 16, delay: i * 0.04 }}
            className={`flex-1 rounded-t-[4px] transition-colors duration-500 ${i === top ? 'bg-maroon' : 'bg-mist/70'}`}
          />
        ))}
      </div>
    </div>
  )
}

function ReorderDemo() {
  const reduce = useReducedMotion()
  const [items, setItems] = useState(['Newsletter', 'Latest video', 'Shop'])
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setItems((a) => [a[a.length - 1], ...a.slice(0, -1)]), 2200)
    return () => clearInterval(t)
  }, [reduce])
  return (
    <ul className="w-full space-y-2">
      {items.map((it, i) => (
        <motion.li layout key={it} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          className={`flex items-center gap-2 rounded-xl border bg-background px-3 py-2 text-sm font-medium ${i === 0 ? 'border-foreground/40 shadow-md' : ''}`}>
          <GripVertical className="size-4 text-muted-foreground" /> {it}
        </motion.li>
      ))}
    </ul>
  )
}

function BadgesDemo() {
  const types = ['instagram', 'tiktok', 'youtube', 'pinterest', 'snapchat', 'linkedin', 'x', 'whatsapp']
  return (
    <div className="flex flex-wrap gap-2.5">
      {types.map((t, i) => (
        <motion.span key={t} initial={{ scale: 0, rotate: -20 }} whileInView={{ scale: 1, rotate: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.06, type: 'spring', stiffness: 380, damping: 14 }} whileHover={{ y: -4 }}>
          <TypeBadge type={t} className="size-11" />
        </motion.span>
      ))}
    </div>
  )
}

function ThemesDemo() {
  const swatches = [
    ['Light', 'linear-gradient(135deg,#f7f5ee,#e3f1d0)'],
    ['Sage', 'linear-gradient(135deg,#e4ebe0,#cfdcc8)'],
    ['Blush', 'linear-gradient(135deg,#fbe9ee,#f2cbd6)'],
    ['Midnight', 'linear-gradient(135deg,#0f1a14,#22352a)'],
  ]
  return (
    <div className="grid w-full grid-cols-4 gap-2">
      {swatches.map(([name, bg], i) => (
        <motion.div key={name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ delay: 0.1 + i * 0.1 }} whileHover={{ y: -6 }} className="text-center">
          <div className="h-20 rounded-2xl border shadow-inner" style={{ background: bg }} />
          <p className="mt-1.5 text-xs font-medium text-muted-foreground">{name}</p>
        </motion.div>
      ))}
    </div>
  )
}

function ShareDemo() {
  return (
    <div className="flex w-full items-center gap-2 rounded-full border bg-background p-1.5 pl-4 text-sm">
      <span className="flex-1 truncate font-medium">{SITE.domain}/<span className="text-muted-foreground">you</span></span>
      <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Copy</span>
    </div>
  )
}

export default function FeatureBento() {
  return (
    <section id="features" className="container relative scroll-mt-20 py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 grid place-items-center overflow-hidden opacity-[0.05] [mask-image:radial-gradient(closest-side,black,transparent)]">
        <LogoMark className="size-[42rem] grayscale" animate={false} />
      </div>
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-semibold"><Sparkles className="size-3.5" aria-hidden="true" /> Features</span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Everything you need, nothing you don't</h2>
          <p className="mt-3 text-muted-foreground">A simple, fast link page that stays out of your way, with the details already thought through.</p>
        </div>
        <Link to="/signup" className="group inline-flex items-center gap-1.5 text-sm font-semibold">
          Start building <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
      </div>

      <motion.div
        variants={stagger(0.08)} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
        className="mt-12 grid gap-4 md:grid-cols-6"
      >
        <Tile className="md:col-span-4" tint="from-lilac/50" eyebrow="Fast setup" icon={Zap}
          title="Live in under a minute" text="Pick a username, add your links, and your page is online. No design skills needed.">
          <StepsDemo />
        </Tile>
        <Tile className="md:col-span-2" tint="from-mist/40" eyebrow="Analytics" icon={BarChart3}
          title="See what gets clicked" text="Click counts on every link, so you know what works.">
          <BarsDemo />
        </Tile>
        <Tile className="md:col-span-2" tint="from-card" eyebrow="Reorder" icon={GripVertical}
          title="Drag to reorder" text="Put what matters most on top, anytime.">
          <ReorderDemo />
        </Tile>
        <Tile className="md:col-span-2" tint="from-sand/70" eyebrow="Share" icon={Share2}
          title="One link, everywhere" text="Your bio, stories, email signature or a printed QR code.">
          <div className="w-full space-y-3">
            <ShareDemo />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><QrCode className="size-4" /> QR code included</p>
          </div>
        </Tile>
        <Tile className="md:col-span-2" tint="from-accent/[0.07]" eyebrow="Smart badges" icon={Sparkles}
          title="Socials detected for you" text="Paste a link and we add the right icon automatically.">
          <BadgesDemo />
        </Tile>
        <Tile className="md:col-span-6" tint="from-accent/[0.06]" eyebrow="Make it yours" icon={Palette}
          title="Themes, layouts and your own photo" text="Choose Light, Sage, Blush, Midnight or Auto, pick a Classic, Grid or Minimal layout, and upload a profile picture.">
          <ThemesDemo />
        </Tile>
      </motion.div>
    </section>
  )
}
