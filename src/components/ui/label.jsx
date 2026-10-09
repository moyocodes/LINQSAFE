import { forwardRef } from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

export const Label = forwardRef(({ className, ...props }, ref) => (
  // A nested .font-normal span (the "(optional)" hints) drops back to normal sentence-case body text.
  <LabelPrimitive.Root ref={ref} className={cn(
    'font-mono text-[.64rem] font-medium uppercase leading-none tracking-[.06em] text-foreground/60 sm:text-[.68rem] sm:tracking-[.12em]',
    '[&_.font-normal]:font-sans [&_.font-normal]:text-xs [&_.font-normal]:normal-case [&_.font-normal]:tracking-normal',
    className)} {...props} />
))
Label.displayName = 'Label'
