import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TypeBadge } from '@/lib/linkTypes'

gsap.registerPlugin(ScrollTrigger)

// Atmospheric panel that starts as a rounded, inset "clip" and opens to full width as it scrolls in,
// with a floating profile card (after mindfullyarticulated.com, kept lighter).
export default function ClipShowcase() {
  const root = useRef(null)
  const panel = useRef(null)
  const card = useRef(null)

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = gsap.context(() => {
      // Slides up into the tree section while the rounded inset "clip" opens to full width.
      gsap.fromTo(panel.current,
        { clipPath: 'inset(6% 7% 6% 7% round 40px)', y: '14vh', opacity: 0.6 },
        { clipPath: 'inset(0% 0% 0% 0% round 0px)', y: 0, opacity: 1, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top 95%', end: 'top 15%', scrub: 0.6 } })
      gsap.fromTo(card.current, { y: 80, rotate: -4 }, { y: -30, rotate: 0, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top bottom', end: 'bottom top', scrub: 0.6 } })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="relative -mt-[18vh]">
      <div
        ref={panel}
        className="relative overflow-hidden bg-[radial-gradient(60%_50%_at_80%_5%,hsl(350_55%_80%/.55),transparent_70%),radial-gradient(55%_55%_at_5%_95%,hsl(262_35%_75%/.45),transparent_70%),radial-gradient(40%_40%_at_50%_60%,hsl(20_60%_80%/.25),transparent_70%),linear-gradient(180deg,theme(colors.night.DEFAULT)_0%,hsl(325_28%_18%)_35%,hsl(340_28%_36%)_100%)]"
        style={{ clipPath: 'inset(6% 7% 6% 7% round 40px)' }}
      >
        <div aria-hidden="true" className="absolute inset-y-0 left-1/2 hidden w-px bg-gradient-to-b from-transparent via-white/20 to-white/5 md:block" />
        <div className="container grid min-h-[44rem] items-end gap-10 py-20 md:grid-cols-2">
          <div ref={card} className="mx-auto w-full max-w-[17rem] rounded-2xl bg-white p-5 shadow-[0_40px_80px_-30px_rgba(10,4,9,.6)] md:mx-0">
            <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">M</div>
            <p className="mt-2 text-center font-display text-lg font-bold">Moyosore James</p>
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Fashion · Beauty · Lifestyle</p>
            <div className="mt-3 flex justify-center gap-1.5">
              {['pinterest', 'snapchat', 'tiktok', 'youtube'].map((t) => <TypeBadge key={t} type={t} className="size-7" />)}
            </div>
            <div className="mt-4 space-y-1.5">
              {['Shop my favourites', 'Skincare routine', 'Weekly newsletter'].map((l) => (
                <div key={l} className="rounded-lg border px-3 py-2 text-center text-xs font-medium">{l}</div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between border-t pt-3">
              <p className="text-xs font-semibold">Creator page</p>
              <p className="text-right text-[9px] uppercase tracking-widest text-muted-foreground">Made with<br /><span className="font-bold text-foreground">linqsafe</span></p>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-120px' }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="text-white md:pl-6"
          >
            <h2 className="text-4xl font-bold leading-[1.05] tracking-tight drop-shadow-sm sm:text-5xl">Structure makes<br />it shareable.</h2>
            <p className="mt-3 max-w-sm text-white/80">One calm page that holds your socials, shop and work, so people find the right thing first.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/signup" className="rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-widest text-foreground transition-transform hover:-translate-y-0.5">Create your page</Link>
              <a href="#features" className="rounded-full border border-white/40 px-6 py-3 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-white/10">See features</a>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
