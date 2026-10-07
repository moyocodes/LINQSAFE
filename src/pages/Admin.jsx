import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { BarChart3, Check, ChevronDown, ChevronUp, GripVertical, Loader2, LogOut, Plus, Trash2 } from 'lucide-react'
import { api, getToken, setToken } from '@/api'
import ShareButton from '@/ShareButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTitle } from '@/lib/useTitle'

function LinkRow({ link, index, total, onChange, onSave, onRemove, onMove, onDragEnd }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={link} dragListener={false} dragControls={controls} onDragEnd={onDragEnd}
      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
      className="relative overflow-hidden rounded-lg border bg-card"
      whileDrag={{ scale: 1.02, boxShadow: '0 10px 30px rgba(0,0,0,.12)', zIndex: 10 }}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button" aria-label="Drag to reorder" onPointerDown={(e) => controls.start(e)}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-accent active:cursor-grabbing"
        >
          <GripVertical className="size-5" aria-hidden="true" />
        </button>
        <div className="grid flex-1 gap-2">
          <Input placeholder="Link title" aria-label={`Title for link ${index + 1}`} value={link.title} onChange={(e) => onChange({ title: e.target.value })} onBlur={onSave} />
          <Input placeholder="https://example.com" aria-label={`URL for link ${index + 1}`} value={link.url} onChange={(e) => onChange({ url: e.target.value })} onBlur={onSave} />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Badge variant="secondary"><BarChart3 className="mr-1 size-3" aria-hidden="true" />{link.clicks}<span className="sr-only"> clicks</span></Badge>
          <div className="flex">
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${link.title || 'link'} up`} disabled={index === 0} onClick={() => onMove(-1)}><ChevronUp /></Button>
            <Button variant="ghost" size="icon" className="size-8" aria-label={`Move ${link.title || 'link'} down`} disabled={index === total - 1} onClick={() => onMove(1)}><ChevronDown /></Button>
            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Delete ${link.title || 'link'}`} onClick={onRemove}>
              <Trash2 />
            </Button>
          </div>
        </div>
      </div>
    </Reorder.Item>
  )
}

function Preview({ me }) {
  const name = me.display_name || me.username
  return (
    <div className="mx-auto w-[260px] rounded-[2.5rem] border-[6px] border-foreground/90 bg-gradient-to-b from-lime-200 to-amber-50 p-5 shadow-xl">
      <div className="mx-auto mt-2 grid size-14 place-items-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
        {name[0]?.toUpperCase()}
      </div>
      <p className="mt-2 text-center text-sm font-semibold">{name}</p>
      {me.bio && <p className="text-center text-xs text-muted-foreground">{me.bio}</p>}
      <div className="mt-4 min-h-[8rem] space-y-2 pb-3">
        {me.links.map((l) => (
          <div key={l.id} className="truncate rounded-xl bg-white px-3 py-2 text-center text-xs font-medium shadow-sm">{l.title || 'Untitled'}</div>
        ))}
      </div>
    </div>
  )
}

export default function Admin() {
  useTitle('Dashboard')
  const [me, setMe] = useState(null)
  const [newLink, setNewLink] = useState({ title: '', url: '' })
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [adding, setAdding] = useState(false)
  const [announce, setAnnounce] = useState('')
  const navigate = useNavigate()
  const latest = useRef(null)
  latest.current = me

  useEffect(() => {
    if (!getToken()) return navigate('/login')
    api('/me').then(setMe).catch(() => { setToken(null); navigate('/login') })
  }, [navigate])

  if (!me)
    return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin text-muted-foreground" role="status" aria-label="Loading" /></div>

  const profileUrl = `${location.origin}/${me.username}`
  const patchLink = (id, patch) =>
    setMe((m) => ({ ...m, links: m.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }))

  async function saveProfile() {
    await api('/profile', { method: 'PUT', body: { display_name: me.display_name, bio: me.bio } })
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function addLink(e) {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      const link = await api('/links', { method: 'POST', body: newLink })
      setMe({ ...me, links: [...me.links, link] })
      setNewLink({ title: '', url: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setAdding(false)
    }
  }

  async function saveLink(id) {
    const l = latest.current.links.find((x) => x.id === id)
    if (!l) return
    setError('')
    try {
      await api(`/links/${id}`, { method: 'PUT', body: l })
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeLink(id) {
    if (!window.confirm('Delete this link?')) return
    await api(`/links/${id}`, { method: 'DELETE' })
    setMe({ ...me, links: me.links.filter((l) => l.id !== id) })
  }

  async function move(index, dir) {
    const links = [...latest.current.links]
    const j = index + dir
    if (j < 0 || j >= links.length) return
    ;[links[index], links[j]] = [links[j], links[index]]
    setMe({ ...latest.current, links })
    setAnnounce(`${links[j].title || 'Link'} moved to position ${j + 1} of ${links.length}`)
    await api('/links-order', { method: 'PUT', body: { ids: links.map((l) => l.id) } }).catch((e) => setError(e.message))
  }

  const persistOrder = () =>
    api('/links-order', { method: 'PUT', body: { ids: latest.current.links.map((l) => l.id) } }).catch((e) => setError(e.message))

  return (
    <div className="container grid gap-8 py-10 lg:grid-cols-[1fr_300px]">
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-bold tracking-tight">Your links</h1>
          <Button variant="ghost" size="sm" onClick={() => { setToken(null); navigate('/') }}><LogOut /> Log out</Button>
        </div>

        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <Link className="break-all text-sm font-semibold text-foreground underline underline-offset-4" to={`/${me.username}`}>{profileUrl}</Link>
            <ShareButton url={profileUrl} title={me.display_name || me.username} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>How your page introduces you.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dn">Display name</Label>
              <Input id="dn" placeholder="Alex Rivera" maxLength={80} value={me.display_name} onChange={(e) => setMe({ ...me, display_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Input id="bio" placeholder="Designer & creator. Sharing my work and ideas." maxLength={255} value={me.bio} onChange={(e) => setMe({ ...me, bio: e.target.value })} />
            </div>
            <Button variant="secondary" onClick={saveProfile}>{saved ? <><Check aria-hidden="true" /> Saved</> : 'Save profile'}</Button>
            <span role="status" className="sr-only">{saved ? 'Profile saved' : ''}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
            <CardDescription>Drag the handle to reorder. Changes save automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Reorder.Group axis="y" values={me.links} onReorder={(links) => setMe({ ...me, links })} className="space-y-3">
              <AnimatePresence initial={false}>
                {me.links.map((l, i) => (
                  <LinkRow key={l.id} link={l} index={i} total={me.links.length} onMove={(d) => move(i, d)}
                    onChange={(patch) => patchLink(l.id, patch)} onSave={() => saveLink(l.id)}
                    onRemove={() => removeLink(l.id)} onDragEnd={persistOrder} />
                ))}
              </AnimatePresence>
            </Reorder.Group>
            {me.links.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No links yet. Add your first one below.</p>}

            <form onSubmit={addLink} className="grid gap-2 rounded-lg border border-dashed p-3 sm:grid-cols-[1fr_1.4fr_auto]">
              <Input placeholder="e.g. My latest video" aria-label="New link title" required value={newLink.title} onChange={(e) => setNewLink({ ...newLink, title: e.target.value })} />
              <Input placeholder="https://youtube.com/…" aria-label="New link URL" type="url" inputMode="url" required value={newLink.url} onChange={(e) => setNewLink({ ...newLink, url: e.target.value })} />
              <Button disabled={adding} aria-busy={adding}>{adding ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} Add link</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
        <div className="sticky top-24">
          <p className="mb-3 text-center text-sm font-medium text-muted-foreground">Live preview</p>
          <Preview me={me} />
        </div>
      </motion.aside>
    </div>
  )
}
