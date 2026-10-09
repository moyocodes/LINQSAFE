import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

export default function ShareButton({ url, title, variant = 'outline', className }) {
  const [copied, setCopied] = useState(false)

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (e) {
        if (e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      toast('Could not copy. Long-press your link to copy it.', 'error')
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    // Icon only; the label is for screen readers and the tooltip ("Copied" once the link is on the clipboard).
    <Button variant={variant} size="icon" className={`size-10 ${className || ''}`} onClick={share} aria-label={copied ? 'Link copied' : 'Share'} title={copied ? 'Link copied' : 'Share'}>
      {copied ? <Check /> : <Share2 />}
    </Button>
  )
}
