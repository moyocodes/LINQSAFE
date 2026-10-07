import { motion } from 'framer-motion'
import { SITE } from '@/config'
import { useTitle } from '@/lib/useTitle'

export function Legal({ title, children }) {
  useTitle(title)
  return (
    <motion.article initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="container max-w-3xl py-16">
      <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated {SITE.legalUpdated}</p>
      <div className="mt-8 space-y-4 leading-7 text-muted-foreground [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6">
        {children}
      </div>
    </motion.article>
  )
}
