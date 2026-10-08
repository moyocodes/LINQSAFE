import { useState } from 'react'
import { useReducedMotion } from 'framer-motion'

// Optional brand media from /public/media. Anything missing falls back to a brand gradient, so the page
// never shows a broken image. See public/media/README.md for the files and the prompts used to make them.

// src can be a list: each one is tried in turn (e.g. a real photo first, then a bundled illustration).
export function Photo({ src, alt = '', className = '', fallback = 'bg-[linear-gradient(135deg,#F2A07E,#E5D2BD_45%,#93ACCF)]', children }) {
  const list = [].concat(src)
  const [i, setI] = useState(0)
  return (
    <div className={`relative overflow-hidden ${fallback} ${className}`}>
      {i < list.length && <img key={list[i]} src={list[i]} alt={alt} loading="lazy" decoding="async" onError={() => setI(i + 1)} className="absolute inset-0 size-full object-cover" />}
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
        ? <img src={poster} alt="" onError={() => setFailed(true)} className="ambient-media size-full object-cover opacity-70" />
        : <video src={src} poster={poster} autoPlay muted loop playsInline preload="metadata" onError={() => setFailed(true)} className="ambient-media size-full object-cover opacity-70" />)}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/55 to-background/80" />
    </div>
  )
}
