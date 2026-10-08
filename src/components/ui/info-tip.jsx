import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Info } from 'lucide-react'

// Small ⓘ that explains how a number is worked out. Opens on hover, focus or tap; Esc or tapping away closes it.
export function InfoTip({ children, label = 'How this is calculated', className = '' }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const id = useId()
  const box = useRef(null)
  useEffect(() => {
    if (!pinned) return
    const away = (e) => { if (!box.current?.contains(e.target)) { setPinned(false); setOpen(false) } }
    const esc = (e) => { if (e.key === 'Escape') { setPinned(false); setOpen(false) } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [pinned])
  return (
    <span ref={box} className={`relative inline-flex align-middle normal-case tracking-normal ${className}`}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => !pinned && setOpen(false)}>
      <button type="button" aria-label={label} aria-expanded={open} aria-describedby={open ? id : undefined}
        onClick={() => { setPinned(!pinned); setOpen(!pinned) }} onFocus={() => setOpen(true)} onBlur={() => !pinned && setOpen(false)}
        className="grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:text-accent focus-visible:text-accent">
        <Info className="size-3.5" aria-hidden="true" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.span id={id} role="tooltip" initial={{ opacity: 0, y: 4, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-md border bg-card p-3 text-left font-sans text-xs font-normal leading-relaxed text-card-foreground shadow-xl">
            {children}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
