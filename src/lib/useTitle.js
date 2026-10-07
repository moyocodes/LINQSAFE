import { useEffect } from 'react'
import { SITE } from '@/config'

export function useTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE.name}` : `${SITE.name} — ${SITE.tagline}`
  }, [title])
}
