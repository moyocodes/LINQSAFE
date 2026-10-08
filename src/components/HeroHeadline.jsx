import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'

const WORDS = ['everything', 'your videos', 'your shop', 'your music', 'your art']

// Headline that reveals word by word, then keeps cycling the highlighted word.
export default function HeroHeadline() {
  const reduce = useReducedMotion()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2400)
    return () => clearInterval(t)
  }, [reduce])

  const word = (text, d) => (
    <motion.span
      className="inline-block"
      initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ delay: d, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {text}
    </motion.span>
  )

  return (
    <h1 className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
      <span className="sr-only">Ones link for everything you share</span>
      <span aria-hidden="true">
        {word('One', 0.1)} {word('link', 0.2)} {word('for', 0.3)}{' '}
        <motion.span
          layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, type: 'spring', stiffness: 260, damping: 20 }}
          className="relative inline-grid overflow-hidden rounded-md bg-saffron/20 px-2 align-bottom text-maroon ring-1 ring-inset ring-saffron/50"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={WORDS[i]} className="col-start-1 row-start-1 whitespace-nowrap"
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '-100%', opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              {WORDS[i]}
            </motion.span>
          </AnimatePresence>
        </motion.span>{' '}
        {word('you', 0.6)} {word('share', 0.7)}
      </span>
    </h1>
  )
}
