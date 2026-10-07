// Which deployment this is (local / dev / prod) and whether we're on the founder subdomain.
// VITE_APP_STAGE is set per environment (.env locally, Vercel env vars for dev/prod).
export const STAGE = import.meta.env.VITE_APP_STAGE || (import.meta.env.DEV ? 'local' : 'prod')

// admin.linqsafe.com, admin-dev.linqsafe.com, admin.localhost — or an exact host from VITE_ADMIN_HOST.
const host = typeof window !== 'undefined' ? window.location.hostname : ''
const configured = (import.meta.env.VITE_ADMIN_HOST || '').split(',').map((h) => h.trim()).filter(Boolean)
export const IS_ADMIN_HOST = configured.length ? configured.includes(host) : /^admin(-[a-z]+)?\./.test(host)
