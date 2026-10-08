// App appearance for the dashboard and other app pages: 'light' | 'dark' | 'system' (follows the device).
// Stored per browser. Public profile pages ignore it and use the owner's chosen theme.
import { useEffect, useState } from 'react'

const KEY = 'lh_appearance'
const read = () => { try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' } }
const media = () => window.matchMedia('(prefers-color-scheme: dark)')

export function applyAppearance(mode = read()) {
  const dark = mode === 'dark' || (mode === 'system' && media().matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17120f' : '#f6f3ee')
}

export function useAppearance() {
  const [mode, setMode] = useState(read)
  useEffect(() => {
    applyAppearance(mode)
    try { localStorage.setItem(KEY, mode) } catch { /* storage blocked */ }
    if (mode !== 'system') return
    const mq = media()
    const on = () => applyAppearance('system')
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [mode])
  return [mode, setMode]
}
