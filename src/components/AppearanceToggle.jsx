import { AnimatePresence, motion } from 'framer-motion'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useAppearance } from '@/lib/theme'

const NEXT = { light: 'dark', dark: 'system', system: 'light' }
const ICON = { light: Sun, dark: Moon, system: Monitor }
const LABEL = { light: 'Light', dark: 'Dark', system: 'System' }

// Cycles Light → Dark → System.
export default function AppearanceToggle({ className = '' }) {
  const [mode, setMode] = useAppearance()
  const Icon = ICON[mode]
  return (
    <button type="button" onClick={() => setMode(NEXT[mode])}
      aria-label={`Appearance: ${LABEL[mode]}. Switch to ${LABEL[NEXT[mode]]}`} title={`Appearance: ${LABEL[mode]}`}
      className={`relative grid size-10 place-items-center overflow-hidden rounded-[3px] border border-foreground/15 text-foreground transition-colors hover:bg-foreground/5 ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={mode} initial={{ y: 14, rotate: -40, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -14, rotate: 40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 24 }}>
          <Icon className="size-4" aria-hidden="true" />
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
