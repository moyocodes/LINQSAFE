import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import { ArrowRight, ArrowUpRight, BarChart3, Check, GripVertical, Palette, QrCode, Share2, Zap } from 'lucide-react'
import { fadeUp, stagger } from '@/lib/motion'
import { TypeBadge } from '@/lib/linkTypes'
import { LogoMark } from '@/components/Logo'
import { SITE } from '@/config'
import { PROFILE_TEMPLATES } from '@/components/ProfileTemplates'

// Features as a sideways row of large visual cards (soft gradient stage + a floating product mockup),
// with a big title and description under each. One row keeps the page short.
function Slide({ bg, title, text, chip, bare, children, i }) {
  return (
    <motion.article initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: (i % 3) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className="group w-[82vw] shrink-0 snap-start sm:w-[min(30rem,calc((100svh-360px)*16/11))] lg:w-[min(36rem,calc((100svh-360px)*16/11))]">
      <div className={`relative grid aspect-[16/11] place-items-center overflow-hidden rounded-[1.75rem] p-6 sm:p-10 ${bg}`} aria-hidden="true">
        {bare ? <div className="theme-light relative w-full text-foreground">{children}</div> : (
          <motion.div whileHover={{ y: -6, rotate: -0.5 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="theme-light relative w-full max-w-sm rounded-2xl bg-card p-5 text-foreground shadow-[0_30px_60px_-24px_hsl(20_35%_18%/.45)]">
            {children}
          </motion.div>
        )}
        {chip && (
          <motion.span initial={{ opacity: 0, y: 12, scale: 0.9 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }}
            transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 18 }}
            className="theme-light absolute bottom-5 right-5 flex items-center gap-2 rounded-xl bg-card px-3.5 py-2.5 text-sm font-medium text-foreground shadow-xl sm:bottom-8 sm:right-8">
            {chip}
          </motion.span>
        )}
      </div>
      <h3 className="mt-6 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h3>
      <p className="mt-2 max-w-md text-base leading-7 text-muted-foreground sm:text-lg">{text}</p>
    </motion.article>
  )
}

function StepsDemo() {
  const steps = ['Pick a username', 'Add your links', 'Share & go live']
  return (
    <ol className="grid w-full gap-2.5">
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
  const types = ['instagram', 'threads', 'tiktok', 'youtube', 'pinterest', 'snapchat', 'linkedin', 'x', 'whatsapp']
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

// Real templates (the same components public pages use), rendered with sample content in mini phones.
const svgUri = (svg) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
const SAMPLE_AVATAR = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2A07E"/><stop offset="1" stop-color="#77313F"/></linearGradient></defs><rect width="120" height="120" fill="url(#g)"/><circle cx="60" cy="48" r="22" fill="#F6E3D3"/><path d="M18 120c6-26 24-38 42-38s36 12 42 38z" fill="#F6E3D3"/><path d="M36 46c0-18 12-28 26-28s24 10 22 30c-6-10-16-14-26-14s-16 4-22 12z" fill="#261F1C"/></svg>`)
const SAMPLE_COVER = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#93ACCF"/><stop offset=".55" stop-color="#F2A07E"/><stop offset="1" stop-color="#77313F"/></linearGradient></defs><rect width="400" height="600" fill="url(#s)"/><circle cx="290" cy="190" r="70" fill="#F2D29A" opacity=".9"/><path d="M0 420 120 330l90 60 80-70 110 90v190H0z" fill="#261F1C" opacity=".55"/><path d="M0 480l140-80 110 70 150-60v190H0z" fill="#261F1C" opacity=".8"/></svg>`)
const SAMPLE = {
  avatar_url: SAMPLE_AVATAR, cover_url: SAMPLE_COVER, bg_blur: 1,
  bio: 'Lagos stylist. December bookings are open.', occupation: 'Fashion stylist', location: 'Lagos, Nigeria', tags: 'Fashion, Styling, Lagos',
  whatsapp: '', testimonials: [],
  links: [
    { id: 1, type: 'instagram', title: 'Instagram', url: '#' }, { id: 2, type: 'tiktok', title: 'TikTok', url: '#' }, { id: 3, type: 'youtube', title: 'YouTube', url: '#' },
    { id: 4, type: 'website', title: 'Book a styling session', url: '#' }, { id: 5, type: 'store', title: 'Shop my edits', url: '#' }, { id: 6, type: 'website', title: 'Lookbook 2026', url: '#' },
  ],
}
const SHOWCASE = [['cover', 'Cover'], ['backdrop', 'Photo background'], ['editorial', 'Editorial'], ['idcard', 'Profile card'], ['search', 'Search & solve']]

function MiniPhone({ id }) {
  const T = PROFILE_TEMPLATES[id]
  return (
    <div className="h-[300px] w-[150px] overflow-hidden rounded-[1.4rem] border-[4px] border-ink bg-ink shadow-[0_24px_50px_-20px_hsl(20_35%_18%/.55)]">
      {/* 375px-wide page scaled to 0.39; transform also contains the template's fixed backgrounds */}
      <div inert="" className="theme-light pointer-events-none relative isolate h-[770px] w-[375px] origin-top-left overflow-hidden bg-background text-foreground [transform:scale(0.39)]">
        <div className="px-4 py-6"><T data={SAMPLE} name="Amara Okafor" onLinkClick={() => {}} /></div>
      </div>
    </div>
  )
}

function ThemesDemo() {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setI((n) => (n + 1) % SHOWCASE.length), 2800)
    return () => clearInterval(t)
  }, [reduce])
  const at = (k) => SHOWCASE[(i + k + SHOWCASE.length) % SHOWCASE.length]
  return (
    <div className="w-full">
      <div className="relative mx-auto h-[250px] max-w-md origin-top scale-[0.8] sm:h-[310px] sm:scale-100">
        {[-1, 1, 0].map((k) => {
          const [id] = at(k)
          return (
            <motion.div key={`${k}-${id}`} className="absolute left-1/2 top-0 -ml-[75px]"
              initial={{ opacity: 0, x: k * 120, rotate: k * 8, scale: k ? 0.82 : 0.9, y: k ? 18 : 10 }}
              animate={{ opacity: k ? 0.55 : 1, x: k * 110, rotate: k * 7, scale: k ? 0.84 : 1, y: k ? 16 : 0, zIndex: k ? 0 : 10 }}
              transition={{ type: 'spring', stiffness: 160, damping: 22 }}>
              <MiniPhone id={id} />
            </motion.div>
          )
        })}
      </div>
      <div className="mt-3 hidden flex-wrap justify-center gap-1.5 sm:flex">
        {SHOWCASE.map(([id, name], k) => (
          <span key={id} className={`rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors ${k === i ? 'bg-foreground text-background' : 'bg-foreground/5 text-muted-foreground'}`}>{name}</span>
        ))}
      </div>
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

const SLIDES = [
  { bg: 'bg-[linear-gradient(135deg,#C9E7E2,#93ACCF)]', title: 'Live in under a minute', text: 'Pick a username, add your links, and your page is online. No design skills needed.', chip: 'Page is live', demo: <StepsDemo /> },
  { bg: 'bg-[linear-gradient(135deg,#F6D9C8,#E5D2BD_55%,#C7B9DA)]', title: 'Real templates, your photo', text: 'Cover, Photo background, Editorial, Profile card, Search & solve, plus free Classic, Grid and Minimal.', demo: <ThemesDemo />, bare: true },
  { bg: 'bg-[linear-gradient(135deg,#DCE4F2,#93ACCF_70%,#2B4FAF)]', title: 'See what gets clicked', text: 'Views, visitors, clicks per link, countries and the best time to post.', chip: 'Best time: Fri, 7pm', demo: <BarsDemo /> },
  { bg: 'bg-[linear-gradient(135deg,#FBE3D6,#F2A07E)]', title: 'Socials detected for you', text: 'Paste a link and the right icon appears. Instagram, TikTok, YouTube, WhatsApp and more.', chip: 'Instagram detected', demo: <BadgesDemo /> },
  { bg: 'bg-[linear-gradient(135deg,#EFE6DA,#E5D2BD_60%,#D99A2B)]', title: 'One link, everywhere', text: 'Your bio, stories, email signature or a printed QR code.', chip: 'Link copied', demo: <div className="space-y-3"><ShareDemo /><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><QrCode className="size-4" /> QR code included</p></div> },
  { bg: 'bg-[linear-gradient(135deg,#E7E2F1,#C9E7E2)]', title: 'Drag to reorder', text: 'Put what matters most on top, anytime.', demo: <ReorderDemo /> },
]

export default function FeatureBento() {
  const reduce = useReducedMotion()
  const section = useRef(null)
  const row = useRef(null)
  const [distance, setDistance] = useState(0) // how far the row slides sideways
  useEffect(() => {
    if (reduce) return
    const measure = () => row.current && setDistance(Math.max(0, row.current.scrollWidth - window.innerWidth))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(row.current)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [reduce])
  // Vertical scroll through the pinned section moves the cards sideways.
  const { scrollYProgress } = useScroll({ target: section, offset: ['start 65px', 'end end'] })
  const x = useSpring(useTransform(scrollYProgress, [0, 1], [0, -distance]), { stiffness: 160, damping: 30, restDelta: 0.5 })
  const nudge = (dir) => {
    if (reduce) return row.current?.scrollBy({ left: dir * Math.min(600, row.current.clientWidth * 0.8), behavior: 'smooth' })
    window.scrollBy({ top: dir * 600, behavior: 'smooth' })
  }

  const header = (
    <div className="container flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
      <div className="max-w-2xl">
        <p className="eyebrow">Features</p>
        <h2 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">Everything you need, with nothing in the way</h2>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/signup" className="group mr-2 inline-flex items-center gap-1.5 text-sm font-semibold">
          Start building <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </Link>
        {[-1, 1].map((d) => (
          <motion.button key={d} type="button" onClick={() => nudge(d)} whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
            aria-label={d < 0 ? 'Previous features' : 'Next features'}
            className="grid size-11 place-items-center rounded-full border border-foreground/15 bg-card hover:bg-muted">
            <ArrowRight className={`size-4 ${d < 0 ? 'rotate-180' : ''}`} aria-hidden="true" />
          </motion.button>
        ))}
      </div>
    </div>
  )
  const pad = 'pl-4 pr-4 sm:pl-[max(1rem,calc((100vw-1200px)/2+1rem))] sm:pr-[max(1rem,calc((100vw-1200px)/2+1rem))]'
  const slides = SLIDES.map((sl, i) => (
    <Slide key={sl.title} i={i} bg={sl.bg} title={sl.title} text={sl.text} chip={sl.chip} bare={sl.bare}>{sl.demo}</Slide>
  ))

  if (reduce) {
    return (
      <section id="features" className="relative scroll-mt-20 py-20">
        {header}
        <div ref={row} className={`mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${pad}`}>{slides}</div>
      </section>
    )
  }

  return (
    <section id="features" ref={section} data-hide-nav className="relative scroll-mt-20" style={{ height: `calc(100svh + ${distance}px)` }}>
      <div className="sticky top-[65px] flex h-[calc(100svh-65px)] flex-col justify-center overflow-hidden py-8">
        {header}
        <motion.div ref={row} style={{ x }} className={`mt-10 flex w-max gap-6 ${pad}`}>{slides}</motion.div>
        <div className="container mt-6">
          <div className="h-1 w-40 overflow-hidden rounded-full bg-foreground/10">
            <motion.div style={{ scaleX: scrollYProgress }} className="h-full origin-left bg-gradient-to-r from-accent via-rose to-lilac" />
          </div>
        </div>
      </div>
    </section>
  )
}
