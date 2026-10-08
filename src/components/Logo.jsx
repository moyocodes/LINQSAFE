import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SITE } from '@/config'

// Hub mark: one centre linking out to three nodes ("one link for everything").
// Colours come from --logo-* in styles.css: cobalt tile in light mode, cream tile with cobalt wiring in dark mode.
export function LogoMark({ className = 'size-9', animate = true }) {
  const draw = (i) => ({
    initial: animate ? { pathLength: 0 } : false,
    animate: { pathLength: 1 },
    transition: { duration: 0.6, delay: 0.15 + i * 0.12 },
  })
  const pop = (i) => ({
    initial: animate ? { scale: 0 } : false,
    animate: { scale: 1 },
    transition: { type: 'spring', stiffness: 400, damping: 15, delay: 0.5 + i * 0.1 },
  })
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={`${SITE.name} logo`}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--logo-a)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-b)' }} />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" style={{ fill: 'var(--logo-tile)' }} />
      <g stroke="url(#logo-g)" strokeWidth="4" strokeLinecap="round" fill="none">
        <motion.path d="M32 34V16" {...draw(0)} />
        <motion.path d="M32 34 17 44" {...draw(1)} />
        <motion.path d="M32 34l15 10" {...draw(2)} />
      </g>
      <circle cx="32" cy="34" r="7" fill="url(#logo-g)" />
      <motion.circle cx="32" cy="14" r="5" style={{ fill: 'var(--logo-a)', transformOrigin: '32px 14px' }} {...pop(0)} />
      <motion.circle cx="15" cy="45" r="5" style={{ fill: 'var(--logo-c)', transformOrigin: '15px 45px' }} {...pop(1)} />
      <motion.circle cx="49" cy="45" r="5" style={{ fill: 'var(--logo-a)', transformOrigin: '49px 45px' }} {...pop(2)} />
    </svg>
  )
}

// The wordmark is "linqsafe." with an accent full stop.
export function Wordmark({ className = '' }) {
  return <span className={className}>{SITE.name}<span className="text-accent">.</span></span>
}

export default function Logo() {
  return (
    <Link to="/" className="group flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight" aria-label={`${SITE.name} home`}>
      <motion.span whileHover={{ rotate: 12, scale: 1.08 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }} className="block">
        <LogoMark />
      </motion.span>
      <Wordmark />
    </Link>
  )
}
