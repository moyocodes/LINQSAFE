import { AnimatePresence, motion } from 'framer-motion'
import { Moon, Sun } from 'lucide-react'
import { useAppearance } from '@/lib/theme'

// Flips light ⇄ dark. Until it's used, the app follows the device setting.
export default function AppearanceToggle({ className = '' }) {
  const [dark, toggle] = useAppearance()
  const Icon = dark ? Moon : Sun
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} aria-pressed={dark}
      className={`relative grid size-10 place-items-center overflow-hidden rounded-[3px] border border-foreground/15 text-foreground transition-colors hover:bg-foreground/5 ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={dark ? 'dark' : 'light'} initial={{ y: 14, rotate: -40, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -14, rotate: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
          <Icon className="size-4" aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
