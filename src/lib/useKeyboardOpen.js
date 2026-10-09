import { useEffect, useState } from 'react'

// True while the on-screen keyboard is up on a phone.
//
// Floating bars (Preview, Save profile, the QR button) sit at the bottom of the screen. When the
// keyboard opens they end up right on top of the field being typed into, and because the browser also
// scrolls the page to reveal that field, the whole layout appears to jump. Hiding them while typing
// keeps the page still and leaves the field clear.
//
// visualViewport shrinks when the keyboard opens; the window's own height doesn't. Comparing the two is
// the only reliable signal, as there's no keyboard event on iOS.
export default function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const check = () => setOpen(window.innerHeight - vv.height > 150)
    check()
    vv.addEventListener('resize', check)
    return () => vv.removeEventListener('resize', check)
  }, [])
  return open
}
