import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { SITE } from '@/config'

// The brand logo files in /public, all transparent PNGs:
//   logo-mark.png           the square mark on its own
//   logo-wordmark.png       mark + "LINQSAFE" in navy, for light backgrounds
//   logo-wordmark-dark.png  the same with cream letters, for dark backgrounds
// The mark itself is blue, orange and rust, which reads on either, so only the word needs a variant.
const MARK = '/logo-mark.png'
const WORDMARK = '/logo-wordmark.png'
const WORDMARK_DARK = '/logo-wordmark-dark.png'

export function LogoMark({ className = 'size-9', animate = true }) {
  return (
    <motion.img
      src={MARK} alt={`${SITE.name} logo`} width={2000} height={2000} loading="eager" decoding="async"
      initial={animate ? { opacity: 0, scale: 0.9 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className={`${className} object-contain`}
    />
  )
}

// The word on its own, for places that set their own type (the footer watermark).
export function Wordmark({ className = '' }) {
  return <span className={className}>{SITE.name}<span className="text-accent">.</span></span>
}

// The full lock-up. Both variants are rendered and CSS shows one, so the right logo is painted on
// the first frame - no flash of the wrong one while JavaScript works out the theme.
//
// `onDark` forces the light version for a surface that is dark in both themes (the footer, a photo
// header). Left off, it follows the page theme.
export function LogoLockup({ className = 'h-10 w-auto sm:h-11', onDark = false }) {
  const img = 'absolute inset-0 size-full object-contain object-left'
  return (
    <span className={`relative inline-block ${className}`} style={{ aspectRatio: '1186 / 356' }}>
      <img src={WORDMARK_DARK} alt="" aria-hidden="true" width={1186} height={356} decoding="async"
        className={`${img} ${onDark ? '' : 'hidden dark:block'}`} />
      <img src={WORDMARK} alt={SITE.name} width={1186} height={356} loading="eager" decoding="async"
        className={`${img} ${onDark ? 'hidden' : 'dark:hidden'}`} />
    </span>
  )
}

export default function Logo({ onDark = false }) {
  return (
    <Link to="/" className="group flex items-center" aria-label={`${SITE.name} home`}>
      <motion.span whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 15 }} className="block">
        <LogoLockup onDark={onDark} />
      </motion.span>
    </Link>
  )
}
