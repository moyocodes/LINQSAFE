import { motion, useReducedMotion } from 'framer-motion'

const PALETTES = {
  fresh: ['bg-rose/45', 'bg-lilac/40', 'bg-sand/60'],
  blush: ['bg-rose-200/60', 'bg-pink-200/50', 'bg-orange-100/70'],
  sage: ['bg-emerald-100/50', 'bg-sand/40', 'bg-stone-200/50'],
}
const blobs = [
  { cls: '-top-24 -right-20 size-80', x: [0, -60, 20, 0], y: [0, 50, 90, 0], d: 18 },
  { cls: 'top-1/3 -left-28 size-96', x: [0, 70, 20, 0], y: [0, -40, 60, 0], d: 22 },
  { cls: '-bottom-24 right-0 size-80', x: [0, -50, 30, 0], y: [0, -60, -20, 0], d: 20 },
]

const dots = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 8) % 96}%`,
  size: 4 + (i % 3) * 3,
  delay: (i % 7) * 0.9,
  dur: 9 + (i % 5) * 2,
}))

// A looping, video-like ambient background: drifting colour blobs plus rising particles.
export default function MotionBackdrop({ palette = 'fresh', fixed = true }) {
  const reduce = useReducedMotion()
  const colors = PALETTES[palette] || PALETTES.fresh
  return (
    <div aria-hidden="true" className={`pointer-events-none ${fixed ? 'fixed' : 'absolute'} inset-0 overflow-hidden`}>
      {blobs.map((b, i) => (
        <motion.div
          key={i} className={`absolute rounded-full blur-3xl ${colors[i]} ${b.cls}`}
          animate={reduce ? undefined : { x: b.x, y: b.y, scale: [1, 1.15, 0.95, 1] }}
          transition={{ duration: b.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
      {!reduce && dots.map((d, i) => (
        <motion.span
          key={i} className="absolute bottom-0 rounded-full bg-white/70"
          style={{ left: d.left, width: d.size, height: d.size }}
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: fixed ? '-100vh' : '-700px', opacity: [0, 0.9, 0.9, 0] }}
          transition={{ duration: d.dur, delay: d.delay, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </div>
  )
}
