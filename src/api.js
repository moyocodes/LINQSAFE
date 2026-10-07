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
  if (res.status === 401) setSignedIn(false)
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}

export const logout = () => api('/logout', { method: 'POST' }).catch(() => {}).finally(() => setSignedIn(false))
