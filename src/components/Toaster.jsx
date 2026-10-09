import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import { TOAST_MS, onToast } from '@/lib/toast'

const STYLE = {
  error: ['bg-red-600 text-white', CircleAlert],
  success: ['bg-emerald-700 text-white', CircleCheck],
  info: ['bg-ink text-paper', Info],
}

// Toasts slide up at the bottom centre, above the floating buttons; tap one to dismiss it early.
export default function Toaster() {
  const [items, setItems] = useState([])
  useEffect(() => onToast((t) => {
    setItems((list) => [...list.filter((x) => x.message !== t.message), t].slice(-3))
    setTimeout(() => setItems((list) => list.filter((x) => x.id !== t.id)), TOAST_MS)
  }), [])
  return (
    <div aria-live="assertive" className="pointer-events-none fixed inset-x-0 bottom-24 z-[80] flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {items.map((t) => {
          const [cls, Icon] = STYLE[t.kind] || STYLE.info
          return (
            <motion.button key={t.id} type="button" role={t.kind === 'error' ? 'alert' : 'status'} onClick={() => setItems((l) => l.filter((x) => x.id !== t.id))}
              initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-2.5 text-left text-sm font-medium shadow-2xl ${cls}`}>
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><span className="min-w-0 break-words">{t.message}</span>
            </motion.button>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
