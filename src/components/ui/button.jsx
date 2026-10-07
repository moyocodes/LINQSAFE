import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[3px] text-sm font-semibold tracking-[0.01em] transition-colors active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_1px_0_hsl(0_0%_100%/.12)_inset,0_6px_14px_-8px_hsl(20_35%_15%/.6)] hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-foreground/20 bg-transparent hover:border-foreground/40 hover:bg-foreground/[0.03]',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: { default: 'h-11 px-5 py-2', sm: 'h-10 px-3.5', lg: 'h-12 px-8 text-base', icon: 'size-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

const MotionSlot = motion.create(Slot)
const MotionButton = motion.create('button')
const spring = { type: 'spring', stiffness: 500, damping: 30 }

export const Button = forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? MotionSlot : MotionButton
  return <Comp ref={ref} whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={spring} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'
