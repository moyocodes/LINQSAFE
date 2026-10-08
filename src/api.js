// The session itself is an httpOnly cookie the browser sends automatically; scripts can't read it.
// This flag only remembers "probably signed in" so the UI can show the right buttons without a request.
const FLAG = 'lh_signed_in'
try { localStorage.removeItem('token') } catch { /* tokens from before cookie sessions */ }

export const isSignedIn = () => { try { return localStorage.getItem(FLAG) === '1' } catch { return false } }
export const setSignedIn = (on) => {
  try { on ? localStorage.setItem(FLAG, '1') : localStorage.removeItem(FLAG) } catch { /* storage blocked */ }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) {
    const wasSignedIn = isSignedIn()
    setSignedIn(false)
    // Session expired or was signed out elsewhere: send them to log in, then back to where they were.
    // (A wrong password on the login form is also a 401, but there nobody was signed in.)
    if (wasSignedIn && !/^\/(login|register|password)/.test(path) && !/^\/(login|signup|forgot-password|reset-password)/.test(location.pathname)) {
      location.assign(`/login?expired=1&next=${encodeURIComponent(location.pathname + location.search)}`)
      return new Promise(() => {}) // the page is leaving; don't flash an error first
    }
  }
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const logout = () => api('/logout', { method: 'POST' }).catch(() => {}).finally(() => setSignedIn(false))
