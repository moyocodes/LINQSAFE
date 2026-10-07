import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'
import { SITE } from '@/config'

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-bold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-foreground text-accent">
        <Link2 className="size-4" aria-hidden="true" />
      </span>
      {SITE.name}
    </Link>
  )
}
