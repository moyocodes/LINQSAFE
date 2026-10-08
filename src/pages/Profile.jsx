import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { api, isSignedIn } from '@/api'
import MotionBackdrop from '@/components/MotionBackdrop'
import ShareButton from '@/ShareButton'
import NotFound from '@/pages/NotFound'
import { fadeUp, stagger } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { SITE } from '@/config'
import { SOCIAL_KEYS, TypeBadge } from '@/lib/linkTypes'
import { LogoMark, Wordmark } from '@/components/Logo'
import { FounderNote, KindWords, PROFILE_TEMPLATES, WhatsAppButton } from '@/components/ProfileTemplates'
import PageLoader from '@/components/PageLoader'

const visitorTz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' } })()

// keepalive lets the request finish even though the browser is leaving for the link.
const trackClick = (id) =>
  fetch(`/api/click/${id}`, {
    method: 'POST', keepalive: true, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref: document.referrer, tz: visitorTz }),
  }).catch(() => {})

function useMedia(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

export default function Profile() {
  const { username } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const name = data ? data.display_name || data.username : ''
  useTitle(name || username)

  // Load (and count the view) once per username. React's dev StrictMode runs effects twice,
  // which used to record every dev visit as two views.
  const loaded = useRef('')
  useEffect(() => {
    if (loaded.current === username) return
    loaded.current = username
    setData(null)
    setError('')
    api(`/u/${username}?ref=${encodeURIComponent(document.referrer)}&tz=${encodeURIComponent(visitorTz)}${params.get('src') === 'qr' ? '&src=qr' : ''}`)
      .then((d) => {
        // Old username (changed in the last 90 days): go to the new one.
        if (d.moved_to) { loaded.current = ''; navigate(`/${d.moved_to}${location.search}`, { replace: true }); return }
        // Redirect mode: visitors go straight to the chosen link (counted as a click). The owner still sees the page.
        if (d.redirect && !d.own && !params.get('preview') && params.get('embed') !== '1') { trackClick(d.redirect.id); window.location.replace(d.redirect.url); return }
        setData(d)
      })
      .catch((e) => setError(e.message))
  }, [username])

  useEffect(() => {
    if (!data) return
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.content = data.bio || `${name}'s links`
  }, [data, name])

  // ?preview=<template> shows this page in another template without saving (the dashboard's Preview button).
  const PREVIEWABLE = ['classic', 'grid', 'minimal', 'cover', 'editorial', 'search', 'backdrop', 'idcard']
  const preview = PREVIEWABLE.includes(params.get('preview')) ? params.get('preview') : null
  const layout = preview || data?.layout || 'classic'
  // ?embed=1 is the dashboard's live preview: no top bar or buttons; ?theme= previews an unsaved theme.
  const embed = params.get('embed') === '1'
  const themeParam = ['light', 'sage', 'blush', 'midnight', 'auto'].includes(params.get('theme')) ? params.get('theme') : null
  if (error) return <NotFound message={/verify your email/i.test(error) ? error : "This profile doesn't exist."} />
  if (!data)
    return <PageLoader className="min-h-screen" />

  return <ProfileView data={data} layout={layout} theme={themeParam || data.theme} preview={preview} embed={embed} onLinkClick={trackClick} />
}

// The page itself, from data alone. The dashboard renders this directly as its instant live preview
// (no network), passing unsaved edits as `data` and `onLinkClick` that doesn't count clicks.
export function ProfileView({ data: raw, layout, theme: chosen, preview = null, embed = false, onLinkClick = () => {} }) {
  // Hidden links (is_public 0) never show, including in the dashboard's previews.
  const data = raw.links.some((l) => l.is_public === 0) ? { ...raw, links: raw.links.filter((l) => l.is_public !== 0) } : raw
  const name = data.display_name || data.username
  const trackClick = onLinkClick
  const prefersDark = useMedia('(prefers-color-scheme: dark)')
  const midnight = {
    background: 'hsl(330 20% 8%)',
    '--background': '330 20% 8%', '--foreground': '36 30% 94%',
    '--card': '330 14% 15%', '--card-foreground': '36 30% 94%',
    '--primary': '36 30% 94%', '--primary-foreground': '330 20% 8%',
    '--secondary': '330 12% 19%', '--secondary-foreground': '36 30% 94%',
    '--muted': '330 12% 19%', '--muted-foreground': '36 10% 72%',
    '--border': '330 10% 28%', '--input': '330 10% 36%', '--ring': '350 50% 80%',
  }
  const themes = {
    light: { cls: 'bg-soft-page', vars: {} },
    sage: { cls: '', vars: { background: 'hsl(100 14% 90%)' } },
    blush: {
      cls: '',
      vars: {
        background: 'linear-gradient(180deg, hsl(345 60% 95%), hsl(350 45% 90%))',
        '--foreground': '345 35% 28%', '--muted-foreground': '345 18% 45%', '--card': '345 60% 98%',
        '--border': '345 40% 84%', '--primary': '345 45% 62%', '--primary-foreground': '0 0% 100%',
      },
    },
    midnight: { cls: '', vars: midnight },
  }
  const key = chosen === 'auto' ? (prefersDark ? 'midnight' : 'light') : chosen
  const theme = themes[key] || themes.light
  const themeStyle = theme.vars
  const dark = key === 'midnight'
  const linkClass = {
    classic: 'flex items-center justify-between rounded-2xl border bg-card/80 px-5 py-4 font-semibold shadow-sm backdrop-blur',
    grid: 'flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border bg-card/80 p-4 text-center font-semibold shadow-sm backdrop-blur',
    minimal: 'flex items-center justify-between border-b border-foreground/15 py-4 text-left font-medium',
  }[layout]

  return (
    <div className={`relative min-h-screen overflow-hidden text-foreground ${dark ? '' : 'theme-light'} ${theme.cls}`} style={themeStyle}>
      {data.own && data.redirect && !embed && !preview && (
        <div className="fixed inset-x-0 top-0 z-50 truncate bg-accent px-3 py-1 text-center font-mono text-[11px] uppercase tracking-widest text-accent-foreground">
          Redirect on · visitors go straight to {data.redirect.url.replace(/^https?:\/\/(www\.)?/, '')}
        </div>
      )}
      {preview && !embed && (
        <div className="fixed inset-x-0 top-0 z-50 bg-foreground py-1 text-center font-mono text-[11px] uppercase tracking-widest text-background">
          Preview · not saved
        </div>
      )}
      {!dark && <MotionBackdrop palette={key === 'blush' ? 'blush' : key === 'sage' ? 'sage' : 'fresh'} />}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-4 py-6">
        <div className={`flex items-center justify-between ${embed ? 'hidden' : ''} ${['cover', 'search'].includes(layout) ? 'relative z-20 mb-[-4rem] sm:mb-[-4.5rem] sm:px-4 sm:pt-4' : ''} ${['cover', 'search', 'backdrop'].includes(layout) ? '[&_a]:border-white/60 [&_a]:bg-white/85 [&_a]:text-ink [&_button]:border-white/60 [&_button]:bg-white/85 [&_button]:text-ink [&_a]:shadow-lg [&_button]:shadow-lg' : ''}`}>
          {isSignedIn() ? (
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} whileHover={{ x: -2 }}>
              <Link to="/admin" className="inline-flex h-10 items-center gap-1.5 rounded-md border bg-card/80 px-3.5 text-sm font-medium backdrop-blur hover:bg-card">
                <ArrowLeft className="size-4" aria-hidden="true" /> Back to dashboard
              </Link>
            </motion.div>
          ) : (
            // A small linqsafe mark for visitors; opens the site in a new tab so they keep this page.
            <Link to="/" target="_blank" rel="noopener" aria-label="Made with linqsafe" title="Made with linqsafe"
              className="grid size-8 place-items-center rounded-lg opacity-70 transition-opacity hover:opacity-100">
              <LogoMark className="size-5" animate={false} />
            </Link>
          )}
          <ShareButton url={location.href} title={name} />
        </div>

        {PROFILE_TEMPLATES[layout] ? (
          <div className="flex-1">
            {(() => { const T = PROFILE_TEMPLATES[layout]; return <T data={data} name={name} onLinkClick={trackClick} /> })()}
          </div>
        ) : (
        <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className={`flex-1 pt-6 ${layout === 'minimal' ? 'text-left' : 'text-center'}`}>
          <motion.div variants={fadeUp} className={`relative size-28 ${layout === 'minimal' ? '' : 'mx-auto'}`}>
            <motion.span
              aria-hidden="true" className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#8a3b4a,#e8b9c4,#e6d2b5,#8a3b4a)]"
              animate={{ rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.span
              aria-hidden="true" className="absolute inset-0 rounded-full bg-accent/15"
              animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeOut' }}
            />
            <div className="absolute inset-1.5 grid place-items-center overflow-hidden rounded-full bg-primary text-4xl font-bold text-primary-foreground shadow-lg">
              {data.avatar_url
                ? <img src={data.avatar_url} alt="" referrerPolicy="no-referrer" className="size-full rounded-full object-cover" />
                : name[0].toUpperCase()}
            </div>
          </motion.div>
          <motion.h1 variants={fadeUp} className="mt-4 text-2xl font-bold tracking-tight">{name}</motion.h1>
          {data.bio && <motion.p variants={fadeUp} className="mt-1 text-muted-foreground">{data.bio}</motion.p>}
          {data.tags && (
            <motion.p variants={fadeUp} className={`mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground ${layout === 'minimal' ? '' : 'justify-center'}`}>
              {data.tags.split(',').map((t, i) => (
                <span key={t} className="flex items-center gap-2">{i > 0 && <span aria-hidden="true" className="size-1 rounded-full bg-primary" />}{t}</span>
              ))}
            </motion.p>
          )}

          {data.links.some((l) => SOCIAL_KEYS.includes(l.type)) && (
            <motion.div variants={fadeUp} className={`mt-6 flex flex-wrap gap-3 ${layout === 'minimal' ? '' : 'justify-center'}`}>
              {data.links.filter((l) => SOCIAL_KEYS.includes(l.type)).map((l) => (
                <motion.a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" whileHover={{ y: -3, scale: 1.08 }} whileTap={{ scale: 0.92 }}
                  onClick={() => trackClick(l.id)} className="rounded-full shadow-sm">
                  <TypeBadge type={l.type} className="size-11" /><span className="sr-only"> {l.title} (opens in a new tab)</span>
                </motion.a>
              ))}
            </motion.div>
          )}

          <WhatsAppButton number={data.whatsapp} name={name} className="mt-6" />

          <div className={layout === 'grid' ? 'mt-8 grid grid-cols-2 gap-3' : layout === 'minimal' ? 'mt-8 border-t border-foreground/15' : 'mt-8 space-y-3'}>
            {data.links.map((l) => (
              <motion.a
                key={l.id} variants={fadeUp} href={l.url} target="_blank" rel="noopener noreferrer"
                whileHover={layout === 'minimal' ? { x: 4 } : { scale: 1.03, y: -2 }} whileTap={{ scale: 0.98 }}
                onClick={() => trackClick(l.id)}
                className={`group relative overflow-hidden transition-shadow hover:shadow-md ${linkClass}`}
              >
                <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-foreground/15 to-transparent opacity-0 transition-none group-hover:animate-[shimmer_0.9s_ease-out] group-hover:opacity-100" />
                <TypeBadge type={l.type} url={l.url} icon={l.icon_url} className={layout === 'grid' ? 'size-9' : 'size-8'} />
                <span className={layout === 'grid' ? '' : layout === 'minimal' ? 'flex-1' : 'flex-1 text-center'}>{l.title}<span className="sr-only"> (opens in a new tab)</span></span>
                <ExternalLink className={`size-4 text-muted-foreground ${layout === 'grid' ? 'absolute right-2.5 top-2.5 size-3.5' : ''}`} aria-hidden="true" />
              </motion.a>
            ))}
            {data.links.length === 0 && <p className="text-muted-foreground">No links yet.</p>}
          </div>
        </motion.div>
        )}

        <KindWords data={data} onPhoto={['backdrop', 'cover', 'search'].includes(layout)} />
        <FounderNote data={data} name={name} />

        {/* Every public page carries the linqsafe mark. Its links open in a new tab so visitors keep this page. */}
        <footer className="relative z-10 flex flex-col items-center gap-2 pt-10 text-xs text-muted-foreground">
          <motion.div whileHover={{ y: -2, scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link to="/signup" target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full border bg-card/90 py-1.5 pl-1.5 pr-3.5 font-medium text-foreground shadow-sm backdrop-blur">
              <LogoMark className="size-6" animate={false} />
              <span>Made with <Wordmark className="font-display font-bold" /></span>
            </Link>
          </motion.div>
          <span className={['backdrop', 'cover', 'search'].includes(layout) ? 'rounded-full bg-black/55 px-3 py-1 text-white/90 backdrop-blur [&_a:hover]:!text-white' : ''}><Link to="/signup" target="_blank" rel="noopener" className="underline hover:text-foreground">Create your own page</Link><span className="mx-2">·</span><Link to="/privacy" target="_blank" rel="noopener" className="hover:text-foreground">Privacy</Link></span>
        </footer>
      </div>
    </div>
  )
}
