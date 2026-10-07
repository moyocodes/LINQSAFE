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

export const Card = forwardRef(({ className, ...props }, ref) => (
  <motion.div
    ref={ref} className={cn('paper rounded-lg text-card-foreground', className)}
    initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }} {...props}
  />
))
Card.displayName = 'Card'
export const CardHeader = make('CardHeader', 'flex flex-col space-y-1.5 p-6')
export const CardTitle = make('CardTitle', 'text-xl font-semibold leading-none tracking-tight')
export const CardDescription = make('CardDescription', 'text-sm text-muted-foreground')
export const CardContent = make('CardContent', 'p-6 pt-0')
export const CardFooter = make('CardFooter', 'flex items-center p-6 pt-0')
