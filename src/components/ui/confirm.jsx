import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// App-wide replacement for window.confirm / window.prompt: a proper dialog that matches the rest of
// the app, works on phones (the browser ones look like a system error) and can ask for a short answer.
//
//   const ask = useConfirm()
//   if (!await ask({ title: 'Delete this link?' })) return
//   const reason = await ask({ title: 'Suspend @sam?', input: { label: 'Reason' } })   // string | null
//
// With `input`, it resolves to the typed string, or null if dismissed. Without, true / false.

const Ctx = createContext(null)
export const useConfirm = () => useContext(Ctx)

export function ConfirmProvider({ children }) {
  const [req, setReq] = useState(null)
  const resolve = useRef(null)
  const ask = useCallback((opts) => new Promise((done) => { resolve.current = done; setReq(opts) }), [])
  const finish = (value) => { resolve.current?.(value); resolve.current = null; setReq(null) }
  return (
    <Ctx.Provider value={ask}>
      {children}
      <AnimatePresence>{req && <ConfirmDialog key="confirm" {...req} onDone={finish} />}</AnimatePresence>
    </Ctx.Provider>
  )
}

function ConfirmDialog({ title, body, confirmLabel, cancelLabel = 'Cancel', danger, input, onDone }) {
  const [value, setValue] = useState(input?.defaultValue || '')
  const field = useRef(null)
  const panel = useRef(null)
  const cancel = () => onDone(input ? null : false)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && cancel()
    window.addEventListener('keydown', onKey)
    const t = setTimeout(() => (input ? field.current : panel.current)?.focus(), 60)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); document.body.style.overflow = '' }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e) => {
    e?.preventDefault()
    if (input?.required && !value.trim()) return field.current?.focus()
    onDone(input ? value : true)
  }
  return (
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={cancel}>
      <motion.form ref={panel} tabIndex={-1} role="alertdialog" aria-modal="true" aria-label={title} onSubmit={submit} onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 40, scale: 0.98, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="w-full max-w-sm rounded-t-2xl border bg-card p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl outline-none sm:rounded-2xl sm:pb-5">
        <div className="flex gap-3">
          {danger && <span aria-hidden="true" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600"><AlertTriangle className="size-4.5" /></span>}
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold leading-snug">{title}</h2>
            {body && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>}
          </div>
        </div>
        {input && (
          <label className="mt-4 block">
            <span className="font-mono text-[.64rem] font-medium uppercase tracking-[.06em] text-foreground/60 sm:text-[.68rem] sm:tracking-[.12em]">{input.label}</span>
            <Input ref={field} value={value} onChange={(e) => setValue(e.target.value)} placeholder={input.placeholder}
              maxLength={input.maxLength || 200} className="mt-1.5" />
          </label>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={cancel} className="sm:w-auto">{cancelLabel}</Button>
          <Button type="submit" variant={danger ? 'destructive' : 'default'} className="sm:w-auto">{confirmLabel || (danger ? 'Delete' : 'Confirm')}</Button>
        </div>
      </motion.form>
    </motion.div>
  )
}
