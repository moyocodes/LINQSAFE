import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const make = (name, base) => {
  const C = forwardRef(({ className, ...props }, ref) => (
    <div ref={ref} className={cn(base, className)} {...props} />
  ))
  C.displayName = name
  return C
}

// accent: a colour stripe that draws in across the top of the card when it scrolls into view.
const ACCENTS = {
  rose: 'from-rose via-saffron/70 to-rose/30', lilac: 'from-lilac via-mist to-lilac/30', sand: 'from-sand via-saffron/60 to-sand/40',
  mist: 'from-mist via-cobalt/50 to-mist/30', cobalt: 'from-cobalt via-mist to-lilac', saffron: 'from-saffron via-rose to-saffron/30',
}
export const Card = forwardRef(({ className, accent, children, ...props }, ref) => (
  <motion.div
    ref={ref} className={cn('paper relative rounded-lg text-card-foreground', accent && 'overflow-hidden', className)}
    initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} {...props}
  >
    {accent && (
      <motion.span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 origin-left bg-gradient-to-r ${ACCENTS[accent] || ACCENTS.cobalt}`}
        initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }} />
    )}
    {children}
  </motion.div>
))
// A coloured icon chip for card titles.
const CHIP = { rose: 'bg-rose/30 text-[#9b3f22]', lilac: 'bg-lilac/30 text-[#1f6b63]', sand: 'bg-sand/60 text-[#7a5326]', mist: 'bg-mist/35 text-cobalt-deep', cobalt: 'bg-cobalt/15 text-cobalt', saffron: 'bg-saffron/25 text-saffron-deep' }
export function IconChip({ icon: Icon, tone = 'cobalt' }) {
  return (
    <motion.span whileHover={{ rotate: -8, scale: 1.08 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className={`grid size-8 shrink-0 place-items-center rounded-md ${CHIP[tone] || CHIP.cobalt}`}>
      <Icon className="size-4" aria-hidden="true" />
    </motion.span>
  )
}
Card.displayName = 'Card'
export const CardHeader = make('CardHeader', 'flex flex-col space-y-1.5 p-6')
export const CardTitle = make('CardTitle', 'font-display text-xl font-semibold leading-tight tracking-tight text-foreground')
export const CardDescription = make('CardDescription', 'text-sm text-muted-foreground')
export const CardContent = make('CardContent', 'p-6 pt-0')
export const CardFooter = make('CardFooter', 'flex items-center p-6 pt-0')
