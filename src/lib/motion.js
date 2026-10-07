// Shared framer-motion presets.
export const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
}

export const stagger = (delay = 0.07) => ({
  hidden: {},
  show: { transition: { staggerChildren: delay } },
})
