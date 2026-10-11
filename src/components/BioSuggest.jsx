import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Sparkles } from 'lucide-react'
import { api } from '@/api'
import { toast } from '@/lib/toast'

// "Write one for me" under the Bio field: sends the details already on the form (name, what you do,
// where you are, topics) and offers three bios to choose from. Picking one fills the field; nothing
// is saved until the owner saves the section, so a suggestion is always a draft they can edit.
export default function BioSuggest({ me, onPick }) {
  const [busy, setBusy] = useState(false)
  const [options, setOptions] = useState([])

  const enough = (me.display_name || me.occupation || me.tags || me.bio || '').trim().length > 1

  async function write() {
    setBusy(true)
    try {
      const { bios } = await api('/bio/suggest', { method: 'POST', body: {
        display_name: me.display_name || '', bio: me.bio || '', occupation: me.occupation || '',
        location: me.location || '', tags: me.tags || '', category: me.category || '',
      } })
      setOptions(bios)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={write} disabled={busy || !enough}
          className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/[0.06] px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50">
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Sparkles className="size-3.5" aria-hidden="true" />}
          {busy ? 'Writing…' : options.length ? 'Try again' : 'Write one for me'}
        </button>
        <span className="text-xs text-muted-foreground">
          {enough ? 'Uses your name, what you do and your topics.' : 'Add your name or what you do first.'}
        </span>
      </div>

      <AnimatePresence>
        {options.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
            <p className="text-xs text-muted-foreground">Tap one to use it, then edit it however you like.</p>
            <ul className="space-y-2">
              {options.map((b, i) => (
                <li key={i}>
                  <button type="button" onClick={() => { onPick(b); setOptions([]) }}
                    className="w-full rounded-lg border bg-card px-3 py-2.5 text-left text-sm leading-snug transition-colors hover:border-accent/40 hover:bg-muted">
                    {b}
                  </button>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
