import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Centre-crop to the target shape and shrink to WebP so the picture stays small enough to store with the profile.
export async function toSmallDataUrl(file, w, h) {
  const bmp = await createImageBitmap(file)
  const scale = Math.max(w / bmp.width, h / bmp.height)
  const sw = w / scale, sh = h / scale
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  c.getContext('2d').drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, w, h)
  const webp = c.toDataURL('image/webp', 0.82)
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', 0.82) // Safari < 17 can't encode WebP
}

const SHAPES = {
  avatar: { w: 320, h: 320, preview: 'size-16 rounded-full', label: 'Profile picture', hint: "It's cropped to a square and resized automatically." },
  cover: { w: 800, h: 900, preview: 'h-20 w-[4.5rem] rounded-lg', label: 'Cover photo', hint: 'Shown full-width behind your name in the Cover layout. Portrait photos work best.' },
}

export default function AvatarPicker({ value, onChange, name, shape = 'avatar', id = 'avatar' }) {
  const S = SHAPES[shape]
  const input = useRef(null)
  const [error, setError] = useState('')
  const isUpload = value?.startsWith('data:')

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('Please choose an image file.')
    if (file.size > 15 * 1024 * 1024) return setError('That image is over 15 MB.')
    try {
      onChange(await toSmallDataUrl(file, S.w, S.h))
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.")
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{S.label} <span className="font-normal text-muted-foreground">(optional)</span></Label>
      <div className="flex flex-wrap items-center gap-4">
        <motion.div key={value} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className={`grid shrink-0 place-items-center overflow-hidden bg-primary text-2xl font-bold text-primary-foreground ${S.preview}`}>
          {value ? <img src={value} alt={`Your ${S.label.toLowerCase()}`} className="size-full object-cover" /> : name?.[0]?.toUpperCase()}
        </motion.div>
        <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={pick} aria-hidden="true" />
        <Button type="button" variant="outline" size="sm" onClick={() => input.current.click()}><ImagePlus /> Upload image</Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')}><Trash2 /> Remove</Button>}
      </div>
      {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
      <Input id={id} type="url" inputMode="url" placeholder="…or paste an https:// image link"
        value={isUpload ? '' : value || ''} onChange={(e) => onChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">Upload any picture, including ones you create with Meta AI or another image tool. {S.hint}</p>
    </div>
  )
}
