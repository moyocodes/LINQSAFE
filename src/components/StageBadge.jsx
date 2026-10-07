import { STAGE } from '@/lib/stage'

// Small corner ribbon so a dev or local build is never mistaken for production.
export default function StageBadge() {
  if (STAGE === 'prod') return null
  const color = STAGE === 'dev' ? 'bg-amber-500 text-black' : 'bg-sky-600 text-white'
  return (
    <div className={`pointer-events-none fixed left-1/2 top-0 z-[60] -translate-x-1/2 rounded-b-md px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest shadow-lg ${color}`}>
      {STAGE}
    </div>
  )
}
