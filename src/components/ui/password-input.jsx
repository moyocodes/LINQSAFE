import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Password field with a show/hide toggle and a Caps Lock hint.
export const PasswordInput = forwardRef(({ className, id, ...props }, ref) => {
  const [show, setShow] = useState(false)
  const [caps, setCaps] = useState(false)
  const Icon = show ? EyeOff : Eye

  return (
    <div>
      <div className="relative">
        <Input
          ref={ref} id={id} type={show ? 'text' : 'password'} className={cn('pr-12', className)}
          autoCapitalize="none" autoCorrect="off" spellCheck={false}
          {...props}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
          onBlur={() => setCaps(false)}
        />
        <button
          type="button" onClick={() => setShow((s) => !s)}
          aria-label="Show password" aria-pressed={show} aria-controls={id} title={show ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon className="size-5" aria-hidden="true" />
        </button>
      </div>
      <p role="status" className={caps ? 'mt-1.5 text-xs font-medium text-amber-800' : 'sr-only'}>
        {caps ? 'Caps Lock is on' : ''}
      </p>
    </div>
  )
})
PasswordInput.displayName = 'PasswordInput'
