import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, Loader2 } from 'lucide-react'
import { api } from '@/api'
import ShareButton from '@/ShareButton'
import NotFound from '@/pages/NotFound'
import { fadeUp, stagger } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { SITE } from '@/config'

export default function Profile() {
  const { username } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const name = data ? data.display_name || data.username : ''
  useTitle(name || username)

  useEffect(() => {
    setData(null)
    setError('')
    api(`/u/${username}`).then(setData).catch((e) => setError(e.message))
  }, [username])

  useEffect(() => {
    if (!data) return
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.content = data.bio || `${name}'s links`
  }, [data, name])

  if (error) return <NotFound message="This profile doesn't exist." />
  if (!data)
    return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin text-muted-foreground" role="status" aria-label="Loading" /></div>

  return (
    <div className="min-h-screen bg-soft-page">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <div className="flex justify-end">
          <ShareButton url={location.href} title={name} />
        </div>

        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="flex-1 pt-6 text-center">
          <motion.div variants={fadeUp} className="mx-auto grid size-24 place-items-center rounded-full bg-primary text-4xl font-bold text-primary-foreground shadow-lg">
            {name[0].toUpperCase()}
          </motion.div>
          <motion.h1 variants={fadeUp} className="mt-4 text-2xl font-bold tracking-tight">{name}</motion.h1>
          {data.bio && <motion.p variants={fadeUp} className="mt-1 text-muted-foreground">{data.bio}</motion.p>}

          <div className="mt-8 space-y-3">
            {data.links.map((l) => (
              <motion.a
                key={l.id} variants={fadeUp} href={l.url} target="_blank" rel="noopener noreferrer"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => api(`/click/${l.id}`, { method: 'POST' }).catch(() => {})}
                className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-5 py-4 font-semibold shadow-sm backdrop-blur transition-shadow hover:shadow-md"
              >
                <span className="flex-1 text-center">{l.title}<span className="sr-only"> (opens in a new tab)</span></span>
                <ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" />
              </motion.a>
            ))}
            {data.links.length === 0 && <p className="text-muted-foreground">No links yet.</p>}
          </div>
        </motion.div>

        <footer className="pt-10 text-center text-xs text-muted-foreground">
          <Link to="/signup" className="font-medium underline hover:text-foreground">Create your own page on {SITE.name}</Link>
          <span className="mx-2">·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        </footer>
      </div>
    </div>
  )
}
