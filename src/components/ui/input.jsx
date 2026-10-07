import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'flex h-11 w-full rounded-[3px] border border-foreground/15 bg-background/70 px-3 py-2 text-[15px] shadow-[inset_0_1px_2px_hsl(20_30%_20%/.05)] transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/25 focus-visible:border-accent/60 focus-visible:bg-card focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/10 disabled:cursor-not-allowed disabled:opacity-50',
      className
    )}
    {...props}
  />
))
Input.displayName = 'Input'
