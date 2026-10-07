import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Cookie } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getConsent, setConsent } from '@/lib/consent'

// Asks before setting the anonymous visitor cookie used for unique-visitor counts.
// Sign-in cookies are strictly necessary and don't need consent.
export default function CookieNotice() {
  const [open, setOpen] = useState(() => getConsent() == null)
  const choose = (v) => { setConsent(v); setOpen(false) }
  return (
    <AnimatePresence>
      {open && (
        <motion.div role="region" aria-label="Cookie notice"
          initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30, delay: 0.8 }}
          className="fixed inset-x-3 bottom-3 z-[55] mx-auto flex max-w-lg flex-wrap items-center gap-3 rounded-2xl border bg-card/95 p-4 text-sm shadow-2xl backdrop-blur sm:flex-nowrap">
          <Cookie className="size-5 shrink-0 text-accent" aria-hidden="true" />
          <p className="flex-1">We use one anonymous cookie to count unique visitors. No ads, no tracking across sites. <Link to="/privacy" className="underline">Privacy</Link></p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => choose('no')}>Decline</Button>
            <Button size="sm" onClick={() => choose('yes')}>Accept</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
