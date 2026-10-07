const get = () => { try { return localStorage.getItem('token') } catch { return null } }

export const getToken = get
export const setToken = (t) => {
  try { t ? localStorage.setItem('token', t) : localStorage.removeItem('token') } catch { /* storage blocked */ }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(get() && { Authorization: `Bearer ${get()}` }),
    },
    body: body && JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
