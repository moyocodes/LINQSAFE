// App appearance for the dashboard and other app pages: 'light' | 'dark' | 'system' (follows the device).
// Stored per browser; 'system' until the person picks one. Public profile pages ignore it and use the owner's theme.
// One shared store, so every toggle on the page (desktop + mobile navbar) stays in sync.
import { useSyncExternalStore } from 'react'

const KEY = 'lh_appearance'
const read = () => { try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' } }
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set()
let mode = typeof window === 'undefined' ? 'system' : read()

export const isDark = (m = mode) => m === 'dark' || (m === 'system' && media().matches)

export function applyAppearance(m = mode, { fade = false } = {}) {
  const root = document.documentElement
  if (fade && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Briefly let colours ease instead of snapping.
    root.classList.add('theme-fade')
    clearTimeout(applyAppearance.t)
    applyAppearance.t = setTimeout(() => root.classList.remove('theme-fade'), 400)
  }
  const dark = isDark(m)
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17120f' : '#f6f3ee')
}

function setMode(next) {
  mode = next
  try { next === 'system' ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, next) } catch { /* storage blocked */ }
  applyAppearance(next, { fade: true })
  listeners.forEach((l) => l())
}

if (typeof window !== 'undefined') {
  // Follow the device while on 'system'; follow other tabs when they change the setting.
  media().addEventListener('change', () => { if (mode === 'system') { applyAppearance('system', { fade: true }); listeners.forEach((l) => l()) } })
  window.addEventListener('storage', (e) => { if (e.key === KEY) { mode = read(); applyAppearance(mode); listeners.forEach((l) => l()) } })
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
// Returns [isDarkNow, toggle, mode]. toggle flips what you see: light ⇄ dark.
export function useAppearance() {
  const dark = useSyncExternalStore(subscribe, () => isDark(), () => false)
  return [dark, () => setMode(isDark() ? 'light' : 'dark'), mode]
}
