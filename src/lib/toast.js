import { useEffect } from 'react'

// Tiny app-wide toast: toast('Saved') / toast('Something failed', 'error'). <Toaster /> (in App) shows them.
// Every toast stays 2 seconds.
const listeners = new Set()
let next = 1
export function toast(message, kind = 'info') {
  if (!message) return
  const t = { id: next++, message: String(message), kind }
  listeners.forEach((fn) => fn(t))
}
export const onToast = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const TOAST_MS = 2000

// Shows a form's error state as a toast whenever it changes to a new message.
export function useErrorToast(error) {
  useEffect(() => { if (error) toast(error, 'error') }, [error])
}
