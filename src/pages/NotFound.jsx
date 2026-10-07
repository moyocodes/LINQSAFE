import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { useTitle } from '@/lib/useTitle'

export default function NotFound({ message = "We couldn't find that page." }) {
  useTitle('Not found')
  return (
    <div className="container grid min-h-[60vh] place-items-center py-16 text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
        <p className="text-7xl font-extrabold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-semibold">{message}</h1>
        <Button asChild className="mt-6"><Link to="/">Back to home</Link></Button>
      </motion.div>
    </div>
  )
}
