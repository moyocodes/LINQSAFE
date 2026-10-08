import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ShareButton({ url, title, variant = 'outline', size = 'sm', className }) {
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
      window.prompt('Copy this link:', url)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant={variant} size={size} className={className} onClick={share}>
      {copied ? <Check /> : <Share2 />}
      {copied ? 'Copied' : 'Share'}
    </Button>
  )
}
