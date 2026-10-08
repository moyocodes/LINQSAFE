import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Optional brand media from /public/media. Anything missing falls back to a brand gradient, so the page
// never shows a broken image. See public/media/README.md for the files and the prompts used to make them.

export function Photo({ src, alt = '', className = '', fallback = 'bg-[linear-gradient(135deg,#F2A07E,#E5D2BD_45%,#93ACCF)]', children }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={`relative overflow-hidden ${fallback} ${className}`}>
      {!failed && <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />}
      {children}
    </div>
  )
}

// Slow looping background video, fixed behind the page, washed out so text stays readable.
// Reduced motion shows the still poster instead.
export function AmbientVideo({ src, poster, className = '' }) {
  const reduce = useReducedMotion()
  const [failed, setFailed] = useState(false)
  return (
    <div aria-hidden="true" className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`}>
      {!failed && (reduce
        ? <img src={poster} alt="" onError={() => setFailed(true)} className="size-full object-cover opacity-40" />
        : <video src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" onError={() => setFailed(true)} className="size-full object-cover opacity-40" />)}
      <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/85 to-background" />
    </div>
  )
}
