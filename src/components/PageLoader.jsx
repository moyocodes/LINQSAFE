import { motion, useReducedMotion } from 'framer-motion'
import { LogoMark } from '@/components/Logo'

// Branded loading state: the logo draws itself and breathes, with a thin bar sweeping underneath.
// `className` sets the height of the area it centres in (full screen, a card, …).
export default function PageLoader({ label = 'Loading', className = 'min-h-[60vh]' }) {
  const still = useReducedMotion()
  return (
    <div role="status" aria-label={label} className={`grid place-items-center ${className}`}>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }} className="flex flex-col items-center gap-4">
        <motion.span className="block" animate={still ? {} : { scale: [1, 1.06, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
          <LogoMark className="size-12 drop-shadow-lg" />
        </motion.span>
        <span aria-hidden="true" className="relative block h-1 w-28 overflow-hidden rounded-full bg-foreground/10">
          <motion.span className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-gradient-to-r from-transparent via-accent to-transparent"
            animate={still ? {} : { x: ['-100%', '200%'] }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}…</span>
      </motion.div>
    </div>
  )
}
