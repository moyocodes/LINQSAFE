import { lazy as reactLazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import StageBadge from '@/components/StageBadge'
import Toaster from '@/components/Toaster'
import { ConfirmProvider } from '@/components/ui/confirm'
import { IS_ADMIN_HOST } from '@/lib/stage'
import NotFound from '@/pages/NotFound'
import Profile from '@/pages/Profile'

// A page opened before a deploy asks for code files the deploy replaced. When that happens, reload to
// get the new version instead of crashing.
const lazy = (load) => reactLazy(() => load().catch((err) => {
  // Reload to fetch the new files, but at most once every 10 seconds, so a really missing file can't loop.
  let last = 0
  try { last = Number(sessionStorage.getItem('chunk-reload')) || 0; sessionStorage.setItem('chunk-reload', String(Date.now())) } catch { /* storage blocked */ }
  if (Date.now() - last > 10_000) { location.reload(); return new Promise(() => {}) }
  throw err
}))

// Public profile pages are most of the traffic, so only they (and 404) ship in the main bundle;
// the marketing and account pages load when someone opens them.
const Home = lazy(() => import('@/pages/Home'))
const Auth = lazy(() => import('@/pages/Auth'))
const Contact = lazy(() => import('@/pages/Contact'))
const Terms = lazy(() => import('@/pages/Terms'))
const Privacy = lazy(() => import('@/pages/Privacy'))
import PageLoader from '@/components/PageLoader'

// Admin pulls in drag-and-drop code that visitors to public pages never need.
const Admin = lazy(() => import('@/pages/Admin'))
const Analytics = lazy(() => import('@/pages/Analytics'))
const Owner = lazy(() => import('@/pages/Owner'))
const OwnerUsers = lazy(() => import('@/pages/OwnerUsers'))
const OwnerRisk = lazy(() => import('@/pages/OwnerRisk'))
const Pricing = lazy(() => import('@/pages/Pricing'))
const VerifyEmail = lazy(() => import('@/pages/AccountFlows').then((m) => ({ default: m.VerifyEmail })))
const ForgotPassword = lazy(() => import('@/pages/AccountFlows').then((m) => ({ default: m.ForgotPassword })))
const BillingCallback = lazy(() => import('@/pages/AccountFlows').then((m) => ({ default: m.BillingCallback })))
const ResetPassword = lazy(() => import('@/pages/AccountFlows').then((m) => ({ default: m.ResetPassword })))

// The founder subdomain (admin.…) is a separate, minimal app: login + the owner dashboard only.
function AdminHostApp() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/login" element={<Auth mode="login" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/users" element={<OwnerUsers />} />
        <Route path="/risk" element={<OwnerRisk />} />
        <Route path="*" element={<Owner />} />
      </Route>
    </Routes>
  )
}

// ?embed=1 is the dashboard's live preview inside an iframe: no stage badge there.
const EMBED = new URLSearchParams(window.location.search).get('embed') === '1'

export default function App() {
  return (
    <ConfirmProvider>
    <Suspense fallback={<PageLoader className="min-h-screen" />}>
      {!EMBED && <StageBadge />}
      <Toaster />
      {IS_ADMIN_HOST ? <AdminHostApp /> : (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/analytics" element={<Analytics />} />
          <Route path="/owner" element={<Owner />} />
          <Route path="/owner/users" element={<OwnerUsers />} />
          <Route path="/owner/risk" element={<OwnerRisk />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/billing/callback" element={<BillingCallback />} />
          <Route path="/verify" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/404" element={<NotFound />} />
        </Route>
        {/* Public profiles live at the root: /:username. Static routes above win over this. */}
        <Route path="/:username" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      )}
    </Suspense>
    </ConfirmProvider>
  )
}
