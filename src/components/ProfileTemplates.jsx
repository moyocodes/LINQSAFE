import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight, MessageCircle, MousePointer2, Search } from 'lucide-react'
import { LINK_TYPES, SOCIAL_KEYS, TypeBadge } from '@/lib/linkTypes'
import { fadeUp, stagger } from '@/lib/motion'

// Pro profile templates (Cover, Editorial, Profile card) plus pieces any layout can use:
// the founder's note and the business WhatsApp button.

const firstName = (n) => n.split(/\s+/)[0]
const socialsOf = (links) => links.filter((l) => SOCIAL_KEYS.includes(l.type))
const linkProps = (l, onClick) => ({ href: l.url, target: '_blank', rel: 'noopener noreferrer', onClick: () => onClick(l.id) })
// Fills the whole page behind photo templates with a soft, blurred copy of the photo (so wide screens
// don't show empty sides). Fixed, behind the template column.
export function PhotoFill({ src }) {
  if (!src) return null
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden">
      <img src={src} alt="" referrerPolicy="no-referrer" className="size-full scale-110 object-cover opacity-70 blur-3xl saturate-150" />
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/40" />
    </div>
  )
}

const NewTab = () => <span className="sr-only"> (opens in a new tab)</span>

export function WhatsAppButton({ number, name, className = '' }) {
  if (!number) return null
  const text = encodeURIComponent(`Hi ${name}, I found you on your link page.`)
  return (
    <motion.a variants={fadeUp} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
      href={`https://wa.me/${number}?text=${text}`} target="_blank" rel="noopener noreferrer"
      className={`flex items-center justify-center gap-2 rounded-2xl bg-[#25d366] px-5 py-3.5 font-semibold text-[#06260f] shadow-sm ${className}`}>
      <MessageCircle className="size-5" aria-hidden="true" /> Chat on WhatsApp<NewTab />
    </motion.a>
  )
}

function Paperclip() {
  return (
    <svg viewBox="0 0 24 64" className="absolute -top-6 right-6 h-14 w-6 text-[#b8955a]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M8 20V8a4 4 0 0 1 8 0v40a6 6 0 0 1-12 0V16" strokeLinecap="round" />
    </svg>
  )
}

export function FounderNote({ data, name }) {
  if (!data.note_body) return null
  const photo = data.avatar_url || data.cover_url
  return (
    <motion.section
      initial={{ opacity: 0, y: 30, rotate: -1 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Founder's note"
      className="relative mt-10 bg-[#f4efe8] p-3 text-left text-[#2b2522] shadow-[0_30px_60px_-30px_rgba(40,25,20,.45)]"
    >
      <div className="border border-[#2b2522]/40 px-6 pb-6 pt-8">
        {photo && (
          <motion.div initial={{ rotate: 8, scale: 0.9 }} whileInView={{ rotate: 4, scale: 1 }} viewport={{ once: true }}
            className="absolute -top-6 right-2 w-28 bg-white p-1.5 pb-5 shadow-lg">
            <Paperclip />
            <img src={photo} alt="" className="aspect-square w-full object-cover grayscale" />
          </motion.div>
        )}
        <h2 className="font-serif text-4xl font-medium leading-none tracking-tight">Founder's Note</h2>
        <p className="mt-1 font-serif text-lg italic">{name}{data.occupation ? ` — ${data.occupation}` : ''}</p>
        <div className="mt-8 space-y-3 font-serif text-[17px] leading-snug">
          {data.note_body.split(/\n{2,}/).map((p, i) => <p key={i} className="whitespace-pre-line">{p}</p>)}
        </div>
        {data.note_sign && <p className="mt-6 text-center font-script text-5xl text-accent">{data.note_sign}</p>}
      </div>
    </motion.section>
  )
}

export function CoverTemplate({ data, name, onLinkClick }) {
  const img = data.cover_url || data.avatar_url
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="-mx-4 -mt-6 overflow-hidden text-center sm:mx-0 sm:mt-0 sm:rounded-[2rem] sm:shadow-[0_40px_80px_-30px_rgb(0_0_0/.45)]">
      <PhotoFill src={img} />
      <div className="relative h-[30rem] overflow-hidden bg-gradient-to-br from-rose via-sand to-accent/70">
        {img && (
          <motion.img src={img} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover"
            initial={{ scale: 1.12 }} animate={{ scale: 1 }} transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/20 to-black/65" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 px-6 pb-8 text-white">
          <motion.h1 variants={fadeUp} className="font-serif text-4xl font-medium leading-none sm:text-5xl">Hi, I'm <em>{firstName(name)}</em></motion.h1>
          {data.bio && <motion.p variants={fadeUp} className="mx-auto mt-3 max-w-xs text-sm text-white/85">{data.bio}</motion.p>}
          <motion.div variants={fadeUp} className="mt-5 flex justify-center gap-6">
            {socialsOf(data.links).map((l) => {
              const Icon = LINK_TYPES[l.type].icon
              return (
                <motion.a key={l.id} {...linkProps(l, onLinkClick)} whileHover={{ y: -3 }} className="text-white">
                  <Icon className="size-6" aria-hidden="true" /><span className="sr-only">{l.title}</span><NewTab />
                </motion.a>
              )
            })}
          </motion.div>
        </div>
      </div>
      <div className="bg-card px-6 pb-4 pt-8">
        <motion.h2 variants={fadeUp} className="font-serif text-3xl font-medium">Get <em>in touch</em></motion.h2>
        <div className="mt-5 space-y-3">
          <WhatsAppButton number={data.whatsapp} name={name} className="rounded-md" />
          {data.links.filter((l) => !SOCIAL_KEYS.includes(l.type)).map((l) => (
            <motion.a key={l.id} variants={fadeUp} {...linkProps(l, onLinkClick)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
              className="block rounded-md border border-sand bg-sand/80 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-sand">
              {l.title}<NewTab />
            </motion.a>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

export function EditorialTemplate({ data, name, onLinkClick }) {
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="mt-4 bg-[#f4efe8] p-3 text-[#2b2522] shadow-[0_30px_60px_-30px_rgba(40,25,20,.4)]">
      <div className="border border-[#2b2522]/40 px-6 py-10 text-center">
        <motion.p variants={fadeUp} className="text-[10px] uppercase tracking-[0.35em]">{data.tags ? data.tags.split(',').join(' · ') : 'Links & notes'}</motion.p>
        {data.avatar_url && (
          <motion.img variants={fadeUp} src={data.avatar_url} alt="" referrerPolicy="no-referrer" className="mx-auto mt-6 size-24 rounded-full object-cover grayscale" />
        )}
        <motion.h1 variants={fadeUp} className="mt-5 font-serif text-4xl font-medium leading-none sm:text-5xl">{name}</motion.h1>
        {(data.occupation || data.bio) && <motion.p variants={fadeUp} className="mt-2 font-serif text-lg italic">{data.occupation || data.bio}</motion.p>}
        <motion.div variants={fadeUp} className="mx-auto my-8 h-px w-16 bg-accent/60" aria-hidden="true" />
        <ul className="text-left">
          {data.links.map((l) => (
            <motion.li key={l.id} variants={fadeUp}>
              <a {...linkProps(l, onLinkClick)} className="group flex items-center justify-between border-b border-[#2b2522]/20 py-4 font-serif text-xl">
                <span className="transition-transform group-hover:translate-x-1">{l.title}</span>
                <ArrowUpRight className="size-5 text-accent transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                <NewTab />
              </a>
            </motion.li>
          ))}
        </ul>
        <WhatsAppButton number={data.whatsapp} name={name} className="mt-8 rounded-none" />
        {data.note_sign && <p className="mt-8 font-script text-4xl text-accent">{data.note_sign}</p>}
      </div>
    </motion.div>
  )
}

function SafetyPin() {
  return (
    <svg viewBox="0 0 40 120" className="absolute -right-3 -top-8 h-28 w-10 rotate-[18deg] text-stone-400 drop-shadow" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M20 10a8 8 0 1 1 0 16v80M12 18v84a8 8 0 0 0 16 0" strokeLinecap="round" />
      <rect x="10" y="8" width="20" height="16" rx="4" fill="currentColor" />
    </svg>
  )
}

export function IdCardTemplate({ data, name, onLinkClick }) {
  const img = data.avatar_url || data.cover_url
  const handle = socialsOf(data.links)[0]
  const rows = [
    ['Name', name],
    data.occupation && ['Occupation', data.occupation],
    handle && ['Handle', `@${data.username}`],
    data.location && ['Based in', data.location],
  ].filter(Boolean)
  return (
    <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="mt-6 text-left">
      <div className="relative border border-dashed border-foreground/50 p-5">
        <motion.div variants={fadeUp} className="relative w-[78%] -rotate-1 bg-[#e8eef0] p-3 pb-10 shadow-md">
          <SafetyPin />
          {img
            ? <img src={img} alt="" referrerPolicy="no-referrer" className="aspect-[4/5] w-full bg-black object-cover" />
            : <div className="grid aspect-[4/5] w-full place-items-center bg-primary font-serif text-7xl text-primary-foreground">{name[0]}</div>}
        </motion.div>
        <p aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 font-script text-5xl leading-none [writing-mode:vertical-rl]">
          {data.tags?.split(',')[0] || firstName(name)}
        </p>
      </div>
      <motion.dl variants={fadeUp} className="mt-6 grid border border-foreground font-mono text-sm uppercase">
        {rows.map(([k, v]) => (
          <div key={k} className="border-b border-foreground px-3 py-2 last:border-b-0">
            <dt className="font-serif text-xs normal-case tracking-wide">{k}</dt>
            <dd className="pl-6 font-semibold tracking-wider">{v}</dd>
          </div>
        ))}
      </motion.dl>
      <div className="mt-6 space-y-2">
        <WhatsAppButton number={data.whatsapp} name={name} className="rounded-none" />
        {data.links.map((l) => (
          <motion.a key={l.id} variants={fadeUp} {...linkProps(l, onLinkClick)} whileHover={{ x: 4 }}
            className="flex items-center justify-between border border-foreground px-4 py-3 font-mono text-sm font-semibold uppercase tracking-wider hover:bg-foreground hover:text-background">
            {l.title}<ArrowUpRight className="size-4" aria-hidden="true" /><NewTab />
          </motion.a>
        ))}
      </div>
    </motion.div>
  )
}

// "the search: / the solution:" — the bio is typed into a search bar over the photo, then the links answer it.
export function SearchTemplate({ data, name, onLinkClick }) {
  const query = data.bio || data.occupation || `${name}'s favourites`
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? query.length : 0)
  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setN((v) => (v < query.length ? v + 1 : v)), 55)
    return () => clearInterval(t)
  }, [query, reduce])
  const img = data.cover_url || data.avatar_url
  const tilts = [-4, 3, -2, 5, -3]
  return (
    <motion.div variants={stagger(0.1)} initial="hidden" animate="show" className="-mx-4 -mt-6 sm:mx-0 sm:mt-0">
      <PhotoFill src={img} />
      <div className="relative min-h-[40rem] px-6 pb-12 pt-28 text-center">
        {/* Only the photo layer fades out (bottom on phones; sides and bottom from tablet up), so it melts
            into the blurred page background instead of sitting there as a hard-edged card. */}
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-gradient-to-b from-rose via-sand to-lilac [mask-image:linear-gradient(to_bottom,black_75%,transparent)] sm:-inset-x-16 sm:[mask-composite:intersect] sm:[mask-image:linear-gradient(to_right,transparent,black_18%,black_82%,transparent),linear-gradient(to_bottom,black_70%,transparent)]">
          {img && <img src={img} alt="" referrerPolicy="no-referrer" className="absolute inset-0 size-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/10 to-black/40" />
        </div>
        <div className="relative">
          <motion.h1 variants={fadeUp} className="text-3xl font-bold tracking-tight text-white drop-shadow">the search:</motion.h1>
          <motion.div variants={fadeUp} className="relative mx-auto mt-4 flex max-w-sm items-center gap-2 rounded-full bg-white px-5 py-3 text-left text-sm text-black shadow-lg">
            <span className="flex-1">
              <span className="sr-only">{query}</span>
              <span aria-hidden="true">{query.slice(0, n)}<span className="ml-px inline-block h-4 w-px translate-y-0.5 animate-pulse bg-black" /></span>
            </span>
            <Search className="size-5 shrink-0" aria-hidden="true" />
            {n === query.length && (
              <motion.span initial={{ opacity: 0, x: 20, y: 20 }} animate={{ opacity: 1, x: 0, y: 0 }} className="absolute -bottom-6 right-10" aria-hidden="true">
                <MousePointer2 className="size-7 fill-white text-black" />
              </motion.span>
            )}
          </motion.div>
          <motion.p variants={fadeUp} className="mt-16 text-3xl font-bold tracking-tight text-white drop-shadow">the solution:</motion.p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {data.links.map((l, i) => (
              <motion.a key={l.id} {...linkProps(l, onLinkClick)}
                initial={{ opacity: 0, scale: 0.6, rotate: 0 }} animate={{ opacity: 1, scale: 1, rotate: tilts[i % tilts.length] }}
                transition={{ delay: 0.4 + i * 0.12 + (reduce ? 0 : query.length * 0.055), type: 'spring', stiffness: 260, damping: 14 }}
                whileHover={{ rotate: 0, scale: 1.06 }}
                className="inline-flex items-center gap-2 rounded-2xl bg-white/95 py-2.5 pl-2.5 pr-4 text-sm font-semibold text-black shadow-xl">
                <TypeBadge type={l.type} url={l.url} className="size-7" />
                {l.title}<NewTab />
              </motion.a>
            ))}
          </div>
          <WhatsAppButton number={data.whatsapp} name={name} className="mx-auto mt-8 max-w-sm rounded-full" />
        </div>
      </div>
    </motion.div>
  )
}

// Client messages as chat bubbles around a big headline (after the "i got a text" post style).
// `onPhoto`: the page sits on a photo (Photo background), so the section gets its own dark glass panel
// and white bubbles, and always reads whatever the picture behind it looks like.
export function KindWords({ data, onPhoto = false }) {
  const items = data.testimonials || []
  if (!items.length) return null
  const half = Math.ceil(items.length / 2)
  const Bubble = ({ t, i }) => (
    <motion.figure
      initial={{ opacity: 0, scale: 0.6, y: 20 }} whileInView={{ opacity: 1, scale: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay: i * 0.12, type: 'spring', stiffness: 260, damping: 16 }}
      className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-snug ${onPhoto ? 'bg-white text-ink shadow-lg' : 'bg-accent/15 text-foreground'} ${i % 2 ? 'ml-auto rotate-2' : '-rotate-2'}`}
    >
      <blockquote>{t}</blockquote>
      <span aria-hidden="true" className={`absolute -bottom-1.5 size-3 rotate-45 ${onPhoto ? 'bg-white' : 'bg-accent/15'} ${i % 2 ? 'right-6' : 'left-6'}`} />
    </motion.figure>
  )
  return (
    <section aria-label="What clients say" className={`mt-12 space-y-3 ${onPhoto ? 'rounded-3xl bg-black/55 p-5 ring-1 ring-white/15 backdrop-blur-xl' : ''}`}>
      {items.slice(0, half).map((t, i) => <Bubble key={i} t={t} i={i} />)}
      <motion.h2 initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
        className={`py-2 text-center font-display text-5xl font-extrabold lowercase leading-none tracking-tighter sm:text-6xl ${onPhoto ? '!text-white drop-shadow-lg' : 'text-accent'}`}>
        i got a text
      </motion.h2>
      {items.slice(half).map((t, i) => <Bubble key={i + half} t={t} i={i + half} />)}
    </section>
  )
}

// Your photo fills the whole page behind everything, softly blurred or sharp (data.bg_blur), with a dark
// gradient so text stays readable. Links sit on frosted glass.
export function BackdropTemplate({ data, name, onLinkClick }) {
  const img = data.cover_url || data.avatar_url
  const blur = data.bg_blur !== 0 && data.bg_blur !== false
  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 -z-10 overflow-hidden bg-[linear-gradient(135deg,#F2A07E,#6CC3BA_55%,#2B4FAF)]">
        {img && (
          <motion.img src={img} alt="" referrerPolicy="no-referrer"
            initial={{ scale: 1.15, opacity: 0 }} animate={{ scale: blur ? 1.12 : 1.02, opacity: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            className={`size-full object-cover ${blur ? 'blur-2xl saturate-150' : ''}`} />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/55 to-black/80" />
      </div>
      <motion.div variants={stagger(0.08)} initial="hidden" animate="show" className="relative pt-8 text-center text-white">
        <motion.div variants={fadeUp} className="mx-auto size-28 overflow-hidden rounded-full ring-4 ring-white/70 shadow-2xl">
          {data.avatar_url
            ? <img src={data.avatar_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
            : <div className="grid size-full place-items-center bg-white/20 font-display text-4xl backdrop-blur">{name[0]}</div>}
        </motion.div>
        <motion.h1 variants={fadeUp} className="mt-4 text-3xl font-semibold tracking-tight !text-white drop-shadow">{name}</motion.h1>
        {data.bio && <motion.p variants={fadeUp} className="mx-auto mt-2 max-w-xs text-white/85 drop-shadow">{data.bio}</motion.p>}
        <motion.div variants={fadeUp} className="mt-5 flex flex-wrap justify-center gap-3">
          {socialsOf(data.links).map((l) => {
            const Icon = LINK_TYPES[l.type].icon
            return (
              <motion.a key={l.id} {...linkProps(l, onLinkClick)} whileHover={{ y: -3, scale: 1.08 }} whileTap={{ scale: 0.92 }}
                className="grid size-11 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md">
                <Icon className="size-5" /><span className="sr-only">{l.title}</span><NewTab />
              </motion.a>
            )
          })}
        </motion.div>
        <div className="mt-8 space-y-3 text-left">
          <WhatsAppButton number={data.whatsapp} name={name} />
          {data.links.filter((l) => !SOCIAL_KEYS.includes(l.type)).map((l) => (
            <motion.a key={l.id} variants={fadeUp} {...linkProps(l, onLinkClick)} whileHover={{ y: -2, scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between rounded-2xl bg-white/15 px-5 py-4 font-semibold text-white ring-1 ring-white/25 backdrop-blur-xl transition-colors hover:bg-white/25">
              <span>{l.title}</span><ArrowUpRight className="size-4 opacity-80" aria-hidden="true" /><NewTab />
            </motion.a>
          ))}
        </div>
      </motion.div>
    </>
  )
}


// Grid: a bento board. Photo + name side by side, then platform-tinted tiles; the first link is big.
export function GridTemplate({ data, name, onLinkClick }) {
  const tint = (type) => {
    const bg = LINK_TYPES[type]?.bg || '#261F1C'
    return bg.startsWith('linear') ? 'linear-gradient(135deg,#FEDA7533,#D6297633,#4F5BD533)' : `${bg}1f`
  }
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="pt-6">
      <motion.div variants={fadeUp} className="flex items-center gap-4 rounded-3xl border bg-card/80 p-4 shadow-sm backdrop-blur">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary text-3xl font-bold text-primary-foreground">
          {data.avatar_url ? <img src={data.avatar_url} alt="" referrerPolicy="no-referrer" className="size-full object-cover" /> : name[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{name}</h1>
          {(data.occupation || data.bio) && <p className="line-clamp-2 text-sm text-muted-foreground">{data.occupation || data.bio}</p>}
        </div>
      </motion.div>
      <WhatsAppButton number={data.whatsapp} name={name} className="mt-3" />
      <div className="mt-3 grid grid-cols-2 gap-3">
        {data.links.map((l, i) => {
          return (
            <motion.a key={l.id} variants={fadeUp} {...linkProps(l, onLinkClick)} whileHover={{ y: -3, rotate: i % 2 ? 0.6 : -0.6 }} whileTap={{ scale: 0.97 }}
              style={{ background: tint(l.type) }}
              className={`relative flex flex-col justify-between overflow-hidden rounded-3xl border p-4 font-semibold ${i === 0 ? 'col-span-2 min-h-36' : 'aspect-square'}`}>
              <TypeBadge type={l.type} url={l.url} className="size-11 shadow-sm" />
              <span className={i === 0 ? 'text-xl' : 'text-sm leading-snug'}>{l.title}</span>
              <ArrowUpRight className="absolute right-3 top-3 size-4 opacity-50" aria-hidden="true" /><NewTab />
            </motion.a>
          )
        })}
      </div>
    </motion.div>
  )
}

// Minimal: type-first. Oversized name, a small photo, numbered rows, socials as plain words.
export function MinimalTemplate({ data, name, onLinkClick }) {
  const socials = socialsOf(data.links)
  const rest = data.links.filter((l) => !SOCIAL_KEYS.includes(l.type))
  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="pt-10 text-left">
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{data.location || data.occupation || 'Links'}</p>
        {data.avatar_url && <img src={data.avatar_url} alt="" referrerPolicy="no-referrer" className="size-12 rounded-full object-cover grayscale" />}
      </motion.div>
      <motion.h1 variants={fadeUp} className="mt-6 font-serif text-5xl font-medium sm:text-6xl leading-[0.95] tracking-tight">{name}</motion.h1>
      {data.bio && <motion.p variants={fadeUp} className="mt-4 max-w-xs text-muted-foreground">{data.bio}</motion.p>}
      {socials.length > 0 && (
        <motion.p variants={fadeUp} className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          {socials.map((l) => <a key={l.id} {...linkProps(l, onLinkClick)} className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground">{LINK_TYPES[l.type].label.split(' /')[0]}<NewTab /></a>)}
        </motion.p>
      )}
      <WhatsAppButton number={data.whatsapp} name={name} className="mt-6" />
      <ol className="mt-10 border-t border-foreground/80">
        {rest.map((l, i) => (
          <motion.li key={l.id} variants={fadeUp}>
            <motion.a {...linkProps(l, onLinkClick)} whileHover={{ x: 6 }} className="flex items-baseline gap-4 border-b border-foreground/15 py-4">
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
              <span className="flex-1 text-lg">{l.title}</span>
              <ArrowUpRight className="size-4 self-center text-muted-foreground" aria-hidden="true" /><NewTab />
            </motion.a>
          </motion.li>
        ))}
      </ol>
    </motion.div>
  )
}

export const PROFILE_TEMPLATES = { grid: GridTemplate, minimal: MinimalTemplate, cover: CoverTemplate, editorial: EditorialTemplate, idcard: IdCardTemplate, search: SearchTemplate, backdrop: BackdropTemplate }
