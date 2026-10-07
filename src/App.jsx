import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout'
import Home from '@/pages/Home'
import Auth from '@/pages/Auth'
import Contact from '@/pages/Contact'
import Terms from '@/pages/Terms'
import Privacy from '@/pages/Privacy'
import NotFound from '@/pages/NotFound'
import Profile from '@/pages/Profile'

// Admin pulls in drag-and-drop code that visitors to public pages never need.
const Admin = lazy(() => import('@/pages/Admin'))

export default function App() {
  return (
    <Suspense fallback={null}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/signup" element={<Auth mode="signup" />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/404" element={<NotFound />} />
        </Route>
        {/* Public profiles live at the root: /:username. Static routes above win over this. */}
        <Route path="/:username" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
