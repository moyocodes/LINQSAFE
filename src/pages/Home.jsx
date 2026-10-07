import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, BarChart3, GripVertical, Share2, Smartphone, Zap, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fadeUp, stagger } from '@/lib/motion'
import { useTitle } from '@/lib/useTitle'
import { SITE } from '@/config'

// three.js is heavy; load it after the hero has painted.
const TreeStory = lazy(() => import('@/components/TreeStory'))

const features = [
  { icon: Zap, title: 'Set up in a minute', text: 'Pick a username, add your links, and you are live. No design skills needed.' },
  { icon: GripVertical, title: 'Drag to reorder', text: 'Put your most important link first and rearrange anytime with a drag.' },
  { icon: BarChart3, title: 'Click analytics', text: 'See exactly which links people click so you can focus on what works.' },
  { icon: Share2, title: 'Share anywhere', text: 'One short URL for your bio, stories, email signature, or business card.' },
  { icon: Smartphone, title: 'Looks great on mobile', text: 'Fast, responsive pages that feel native on every screen size.' },
  { icon: ShieldCheck, title: 'Yours to control', text: 'Edit or delete your links and account whenever you like.' },
]

const demoLinks = ['My latest video', 'Book a call', 'Portfolio', 'Newsletter']

function PhoneDemo() {
  return (
    <motion.div
      animate={{ y: [0, -8, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="mx-auto w-[260px] rounded-[2.5rem] border-[6px] border-foreground/90 bg-gradient-to-br from-emerald-100 via-lime-50 to-orange-100 p-5 shadow-[0_30px_80px_-20px_hsl(150_30%_8%/.35)]"
    >
      <div className="mx-auto mt-2 grid size-16 place-items-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">A</div>
      <p className="mt-3 text-center font-semibold">Alex Rivera</p>
      <p className="text-center text-xs text-muted-foreground">Designer & creator</p>
      <motion.div variants={stagger(0.12)} initial="hidden" animate="show" className="mt-5 space-y-2.5 pb-4">
        {demoLinks.map((l) => (
          <motion.div key={l} variants={fadeUp} className="rounded-xl border border-white/60 bg-white/80 px-4 py-3 text-center text-sm font-medium shadow-sm backdrop-blur">
            {l}
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  )
}

export default function Home() {
  useTitle()
  return (
    <>
      <section className="bg-hero">
        <div className="container grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
          <motion.div variants={stagger()} initial="hidden" animate="show">
            <motion.span variants={fadeUp} className="inline-block rounded-full border bg-background/70 px-3 py-1 text-xs font-medium">
              Free to start
            </motion.span>
            <motion.h1 variants={fadeUp} className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl">
              One link for{' '}
              <mark className="rounded-xl bg-gradient-to-r from-lime-200 to-emerald-200 px-2 text-accent-foreground">everything</mark>{' '}
              you share
            </motion.h1>
            <motion.p variants={fadeUp} className="mt-5 max-w-md text-lg text-muted-foreground">{SITE.description}</motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/signup">Create your page <ArrowRight /></Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/login">Log in</Link></Button>
            </motion.div>
          </motion.div>
          <div className="relative">
            <div aria-hidden="true" className="absolute inset-0 -z-10 m-auto size-72 rounded-full bg-gradient-to-tr from-lime-200/70 to-orange-200/60 blur-3xl" />
            <PhoneDemo />
          </div>
        </div>
      </section>

      <Suspense fallback={<div className="h-screen bg-[#06100a]" />}>
        <TreeStory />
      </Suspense>

      <section className="container py-20">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-3xl font-bold tracking-tight">Everything you need, nothing you don't</h2>
          <p className="mt-3 text-muted-foreground">A simple, fast link page that stays out of your way.</p>
        </div>
        <motion.div
          variants={stagger()} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}
          className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map(({ icon: Icon, title, text }) => (
            <motion.div key={title} variants={fadeUp} whileHover={{ y: -4 }}>
              <Card className="h-full border-white/70 bg-gradient-to-br from-white to-card shadow-sm transition-shadow hover:shadow-lg">
                <CardContent className="p-6">
                  <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-lime-200 to-emerald-200 text-emerald-950"><Icon className="size-5" /></span>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <section className="container pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="rounded-3xl bg-cta px-6 py-14 text-center text-primary-foreground"
        >
          <h2 className="text-3xl font-bold tracking-tight">Ready to share one link?</h2>
          <p className="mx-auto mt-3 max-w-md opacity-90">Join in seconds. No credit card required.</p>
          <Button asChild size="lg" className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90"><Link to="/signup">Get started</Link></Button>
        </motion.div>
      </section>
    </>
  )
}
