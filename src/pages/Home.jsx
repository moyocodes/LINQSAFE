import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClipShowcase from "@/components/ClipShowcase";
import FeatureBento from "@/components/FeatureBento";
import HeroHeadline from "@/components/HeroHeadline";
import HeroPhoneStory from "@/components/HeroPhoneStory";
import MotionBackdrop from "@/components/MotionBackdrop";
import { fadeUp, stagger } from "@/lib/motion";
import { useTitle } from "@/lib/useTitle";
import { SITE } from "@/config";

// three.js is heavy; load it after the hero has painted.
const TreeStory = lazy(() => import("@/components/TreeStory"));

function PhoneDemo() {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateY = useSpring(useTransform(mx, [-1, 1], [-10, 10]), {
    stiffness: 120,
    damping: 14,
  });
  const rotateX = useSpring(useTransform(my, [-1, 1], [8, -8]), {
    stiffness: 120,
    damping: 14,
  });
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 2 - 1);
    my.set(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  return (
    <motion.div
      onPointerMove={onMove}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      className="mx-auto w-[290px] rounded-[2.5rem] border-[6px] border-foreground/90 bg-gradient-to-br from-rose/40 via-card to-sand/50 p-5 shadow-[0_30px_80px_-20px_hsl(20_16%_13%/.3)]"
    >
      <span
        aria-hidden="true"
        className="mx-auto mb-4 block h-1.5 w-16 rounded-full bg-foreground/80"
      />
      <HeroPhoneStory />
    </motion.div>
  );
}

export default function Home() {
  useTitle();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{ scaleX: progress }}
        className="fixed inset-x-0 top-0 z-50 h-0.5 origin-left bg-saffron"
      />
      <section className="bg-hero relative overflow-hidden">
        <MotionBackdrop fixed={false} />
        <div className="container relative grid items-center gap-12 py-16 md:grid-cols-2 md:py-24">
          <motion.div variants={stagger()} initial="hidden" animate="show">
            <HeroHeadline />
            <motion.p
              variants={fadeUp}
              className="mt-5 max-w-md text-lg text-muted-foreground"
            >
              {SITE.description}
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/signup">
                  Create your page <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            </motion.div>
          </motion.div>
          <div className="relative">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 m-auto size-72 rounded-full bg-gradient-to-tr from-rose/50 to-lilac/40 blur-3xl"
            />
            <PhoneDemo />
          </div>
        </div>
      </section>

      {/* One continuous dark "workshop": the 3D tree story flows straight into the showcase panel,
          which slides up into the same space, then the dark fades into the page below. */}
      <div className="relative bg-night">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_40rem_at_80%_10%,theme(colors.night.plum),transparent_70%),radial-gradient(50rem_40rem_at_10%_75%,hsl(262_35%_30%/.35),transparent_70%)]" />
        <Suspense fallback={<div className="h-screen" />}>
          <TreeStory />
        </Suspense>
        <ClipShowcase />
        <div aria-hidden="true" className="h-24 bg-gradient-to-b from-transparent to-background" />
      </div>

      <FeatureBento />

      <section className="container pb-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-3xl bg-cta px-6 py-14 text-center text-primary-foreground"
        >
          <h2 className="text-3xl font-bold tracking-tight">
            Ready to share one link?
          </h2>
          <p className="mx-auto mt-3 max-w-md opacity-90">
            Join in seconds. No credit card required.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-6 bg-background text-foreground hover:bg-background/90"
          >
            <Link to="/signup">Get started</Link>
          </Button>
        </motion.div>
      </section>
    </>
  );
}
