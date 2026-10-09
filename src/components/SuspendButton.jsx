import { useState } from 'react'
import { Ban, Loader2, RotateCcw } from 'lucide-react'
import { api } from '@/api'
import { toast } from '@/lib/toast'
import { useConfirm } from '@/components/ui/confirm'

// Founder: suspend a page (a 404 everywhere; the owner sees the reason on their dashboard) or lift it.
export default function SuspendButton({ username, suspended, onChange, className = '' }) {
  const [busy, setBusy] = useState(false)
  const ask = useConfirm()
  async function toggle() {
    let req
    if (suspended) {
      const ok = await ask({
        title: `Lift the suspension on @${username}?`,
        body: 'Their page goes live again straight away.',
        confirmLabel: 'Unsuspend',
      })
      if (!ok) return
      req = () => api(`/owner/users/${username}/suspend`, { method: 'DELETE' })
    } else {
      const reason = await ask({
        title: `Suspend @${username}?`,
        body: 'Their page will show "not found" everywhere.',
        confirmLabel: 'Suspend',
        danger: true,
        input: { label: 'Reason (they will see this)', defaultValue: 'Reported for suspicious links', required: true },
      })
      if (reason === null) return
      req = () => api(`/owner/users/${username}/suspend`, { method: 'POST', body: { reason } })
    }
    setBusy(true)
    try { onChange?.(await req()) } catch (e) { toast(e.message, 'error') } finally { setBusy(false) }
  }
  return (
    <button type="button" onClick={toggle} disabled={busy}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60 ${suspended ? 'hover:bg-muted' : 'border-red-200 text-red-700 hover:bg-red-50'} ${className}`}>
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : suspended ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />}
      {suspended ? 'Unsuspend' : 'Suspend'}
    </button>
  )
}
