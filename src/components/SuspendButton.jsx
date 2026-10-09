import { useState } from 'react'
import { Ban, Loader2, RotateCcw } from 'lucide-react'
import { api } from '@/api'

// Founder: suspend a page (a 404 everywhere; the owner sees the reason on their dashboard) or lift it.
export default function SuspendButton({ username, suspended, onChange, className = '' }) {
  const [busy, setBusy] = useState(false)
  async function toggle() {
    let req
    if (suspended) {
      if (!window.confirm(`Lift the suspension on @${username}? Their page goes live again straight away.`)) return
      req = () => api(`/owner/users/${username}/suspend`, { method: 'DELETE' })
    } else {
      const reason = window.prompt(`Suspend @${username}? Their page will show "not found" everywhere.\n\nReason (they will see this):`, 'Reported for suspicious links')
      if (reason === null) return
      req = () => api(`/owner/users/${username}/suspend`, { method: 'POST', body: { reason } })
    }
    setBusy(true)
    try { onChange?.(await req()) } catch (e) { window.alert(e.message) } finally { setBusy(false) }
  }
  return (
    <button type="button" onClick={toggle} disabled={busy}
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-60 ${suspended ? 'hover:bg-muted' : 'border-red-200 text-red-700 hover:bg-red-50'} ${className}`}>
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : suspended ? <RotateCcw className="size-3.5" aria-hidden="true" /> : <Ban className="size-3.5" aria-hidden="true" />}
      {suspended ? 'Unsuspend' : 'Suspend'}
    </button>
  )
}
