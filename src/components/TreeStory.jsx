import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Button } from '@/components/ui/button'

gsap.registerPlugin(ScrollTrigger)

// ---------------------------------------------------------------------------
// Content: the questions the scroll story answers, one per stage of the tree.
// ---------------------------------------------------------------------------
const STEPS = [
  {
    q: 'What is it?',
    title: 'One link. Your whole world.',
    text: 'Every platform gives you a single place for a link. Your page is the trunk, and everything you make grows from it.',
  },
  {
    q: 'Why does it matter?',
    title: 'Attention is scattered.',
    text: 'Your audience is spread across apps. Each link you add is a branch that catches someone who would otherwise slip away.',
  },
  {
    q: 'How does it all connect?',
    title: 'Everything feeds everything.',
    text: 'Your video sends people to your store, your store to your newsletter, your newsletter back to your content. Nothing is a dead end.',
  },
  {
    q: 'What do you do next?',
    title: 'Plant your tree.',
    text: 'Share one URL, then watch which branches grow with live click counts. It takes about a minute.',
  },
]

// Scroll-progress window (0..1) in which each step's text is visible.
const WINDOWS = [[0, 0.28], [0.32, 0.56], [0.6, 0.82], [0.86, 1]]

const BRANCHES = [
  { label: 'Instagram', color: 0xf472b6, leaves: ['Reels', 'Shop'] },
  { label: 'YouTube', color: 0xf87171, leaves: ['Latest video', 'Playlist'] },
  { label: 'Store', color: 0x34d399, leaves: ['Best seller', 'Discount'] },
  { label: 'Newsletter', color: 0xfbbf24, leaves: ['Sign up', 'Archive'] },
  { label: 'Portfolio', color: 0x60a5fa, leaves: ['Case study', 'Book a call'] },
]

const TUBE_SEGMENTS = 48
const TUBE_RADIAL = 6

// ---------------------------------------------------------------------------
// Three.js helpers
// ---------------------------------------------------------------------------
function labelTexture(text) {
  const dpr = 2
  const h = 56
  const font = '600 28px Inter, system-ui, sans-serif'
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = font
  const w = Math.ceil(ctx.measureText(text).width) + 40
  c.width = w * dpr
  c.height = h * dpr
  ctx.scale(dpr, dpr)
  ctx.font = font
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(0, 0, w, h, h / 2)
  else ctx.rect(0, 0, w, h)
  ctx.fillStyle = 'rgba(6,16,10,0.85)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 1)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return { tex, aspect: w / h }
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function buildScene(host, reduced) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch {
    return null // WebGL unavailable: the text story still works without the canvas
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  host.appendChild(renderer.domElement)
  renderer.domElement.setAttribute('aria-hidden', 'true')

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const tree = new THREE.Group()
  scene.add(tree)
  scene.add(new THREE.AmbientLight(0xffffff, 0.8))
  const key = new THREE.PointLight(0xd9f99d, 120, 40)
  key.position.set(0, 5, 8)
  scene.add(key)

  const glow = glowTexture()
  const startScale = reduced ? 1 : 0.001

  // --- nodes -------------------------------------------------------------
  function addNode({ label, pos, color, r }) {
    const group = new THREE.Group()
    group.position.copy(pos)
    group.scale.setScalar(startScale)

    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(r, 3),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1 })
    )
    group.add(mesh)

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow, color, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
    )
    halo.scale.setScalar(r * 6)
    group.add(halo)

    const { tex, aspect } = labelTexture(label)
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
    const lh = r > 0.4 ? 0.5 : 0.36
    sprite.scale.set(lh * aspect, lh, 1)
    sprite.position.y = r + lh * 0.9
    sprite.renderOrder = 10
    group.add(sprite)

    tree.add(group)
    return { group, mesh }
  }

  // --- edges (glowing tubes, revealed with setDrawRange) ------------------
  const edges = []
  function addEdge(a, b, { lift = new THREE.Vector3(0, 0.3, 0), color = 0xd9f99d, opacity = 0.7 } = {}) {
    const mid = a.clone().add(b).multiplyScalar(0.5).add(lift)
    const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone())
    const geo = new THREE.TubeGeometry(curve, TUBE_SEGMENTS, 0.028, TUBE_RADIAL, false)
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    const edge = {
      curve,
      mesh,
      p: { v: reduced ? 1 : 0 },
      draw() {
        geo.setDrawRange(0, Math.floor(this.p.v * TUBE_SEGMENTS) * TUBE_RADIAL * 6)
      },
    }
    edge.draw()
    tree.add(mesh)
    edges.push(edge)
    return edge
  }

  // --- the tree ----------------------------------------------------------
  const rootPos = new THREE.Vector3(0, -2.6, 0)
  const root = addNode({ label: 'your link', pos: rootPos, color: 0xc6f432, r: 0.55 })
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.025, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0xc6f432, transparent: true, opacity: 0.6 })
  )
  ring.rotation.x = Math.PI / 2
  root.group.add(ring)

  const trunk = []
  const leafEdges = []
  const cross = []
  const branchNodes = []
  const leafNodes = []
  const leafPositions = []

  BRANCHES.forEach((b, i) => {
    const t = i / (BRANCHES.length - 1) // 0..1 across the arc
    const theta = (t - 0.5) * 2 * 1.15
    const pos = new THREE.Vector3(Math.sin(theta) * 4.4, 0.2 + Math.cos(theta) * 0.9, (i % 2 ? 1 : -1) * 1.3)
    branchNodes.push(addNode({ label: b.label, pos, color: b.color, r: 0.34 }))
    trunk.push(addEdge(rootPos, pos, { lift: new THREE.Vector3(0, 0.6, 0), color: b.color }))

    const lp = []
    b.leaves.forEach((name, j) => {
      const side = j ? 1 : -1
      const leafPos = new THREE.Vector3(pos.x + side * 1.0 + pos.x * 0.12, pos.y + 1.7 + j * 0.25, pos.z + side * 0.9)
      lp.push(leafPos)
      leafNodes.push(addNode({ label: name, pos: leafPos, color: b.color, r: 0.2 }))
      leafEdges.push(addEdge(pos, leafPos, { lift: new THREE.Vector3(side * 0.2, 0.4, 0), color: b.color, opacity: 0.55 }))
    })
    leafPositions.push(lp)
  })

  // Cross-links: neighbouring branches and their facing leaves connect, so nothing is a dead end.
  for (let i = 0; i < BRANCHES.length - 1; i++) {
    cross.push(addEdge(branchNodes[i].group.position, branchNodes[i + 1].group.position, { lift: new THREE.Vector3(0, 0.9, 0.6), color: 0xffffff, opacity: 0.35 }))
    cross.push(addEdge(leafPositions[i][1], leafPositions[i + 1][0], { lift: new THREE.Vector3(0, 0.7, 0.4), color: 0xffffff, opacity: 0.3 }))
  }

  // --- particles flowing along revealed edges --------------------------------
  const PARTICLES = reduced ? 0 : 90
  const pGeo = new THREE.BufferGeometry()
  const pArr = new Float32Array(PARTICLES * 3).fill(-999)
  pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
  const particles = Array.from({ length: PARTICLES }, () => ({
    e: edges[Math.floor(Math.random() * edges.length)],
    t: Math.random(),
    speed: 0.12 + Math.random() * 0.2,
  }))
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({ size: 0.13, color: 0xffffff, map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  points.frustumCulled = false
  tree.add(points)

  // --- starfield -------------------------------------------------------------
  const starArr = new Float32Array(700 * 3)
  for (let i = 0; i < 700; i++) {
    const r = 18 + Math.random() * 22
    const a = Math.random() * Math.PI * 2
    const b = Math.acos(2 * Math.random() - 1)
    starArr.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starArr, 3))
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ size: 0.09, color: 0xe7f5c4, transparent: true, opacity: 0.8, depthWrite: false })
  )
  scene.add(stars)

  // --- state driven by GSAP + pointer ----------------------------------------
  const view = { zoom: 0, rot: 0 }
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
  let baseZ = 13
  const lookAt = new THREE.Vector3(0, 0.2, 0)
  const tmp = new THREE.Vector3()

  function resize() {
    const w = host.clientWidth || 1
    const h = host.clientHeight || 1
    renderer.setSize(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    const a = w / h
    baseZ = a < 0.8 ? 20 : a < 1.3 ? 15.5 : 12.5
    // Keep the tree clear of the text card: lift it on phones (card is at the bottom), nudge it right on desktop (card is at the left).
    tree.position.set(a > 1.3 ? 2.6 : 0, a < 1 ? 1.7 : -0.3, 0)
    if (reduced) render(0)
  }

  let last = performance.now()
  function render(dt) {
    camera.position.set(0, 0.5 + view.zoom * 1.2, baseZ * (0.85 + view.zoom * 0.25))
    camera.lookAt(lookAt)

    pointer.sx += (pointer.x - pointer.sx) * 0.05
    pointer.sy += (pointer.y - pointer.sy) * 0.05
    const idle = reduced ? 0 : performance.now() * 0.00006
    tree.rotation.y = view.rot * 0.9 + pointer.sx * 0.25 + Math.sin(idle * 6) * 0.08
    tree.rotation.x = pointer.sy * 0.12
    stars.rotation.y += dt * 0.01
    ring.rotation.z += dt * 0.6

    for (let i = 0; i < particles.length; i++) {
      const P = particles[i]
      if (P.e.p.v < 0.98) {
        pArr[i * 3 + 1] = -999
        continue
      }
      P.t = (P.t + P.speed * dt) % 1
      P.e.curve.getPoint(P.t, tmp)
      pArr[i * 3] = tmp.x
      pArr[i * 3 + 1] = tmp.y
      pArr[i * 3 + 2] = tmp.z
    }
    pGeo.attributes.position.needsUpdate = true
    renderer.render(scene, camera)
  }

  let raf = 0
  let visible = true
  function loop(now) {
    raf = requestAnimationFrame(loop)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    if (visible) render(dt)
  }

  const onMove = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting })
  io.observe(host)
  resize()
  if (!reduced) {
    window.addEventListener('pointermove', onMove, { passive: true })
    raf = requestAnimationFrame(loop)
  }

  return {
    view,
    root,
    trunk,
    leafEdges,
    cross,
    branchNodes,
    leafNodes,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onMove)
      scene.traverse((o) => {
        o.geometry?.dispose()
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        mats.forEach((m) => { m.map?.dispose(); m.dispose() })
      })
      glow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TreeStory() {
  const section = useRef(null)
  const host = useRef(null)
  const panels = useRef([])
  const bar = useRef(null)
  const hint = useRef(null)
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const world = buildScene(host.current, reduced)
    if (reduced) return () => world?.dispose()

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: section.current, start: 'top 65px', end: '+=450%', scrub: 0.8, pin: true, anticipatePin: 1 },
      })

      if (world) {
        const pop = { x: 1, y: 1, z: 1, ease: 'back.out(2)' }
        tl.to(world.root.group.scale, { ...pop, duration: 0.08 }, 0.02)
        world.trunk.forEach((e, i) => tl.to(e.p, { v: 1, duration: 0.12, onUpdate: () => e.draw() }, 0.08 + i * 0.03))
        world.branchNodes.forEach((n, i) => tl.to(n.group.scale, { ...pop, duration: 0.06 }, 0.17 + i * 0.03))
        world.leafEdges.forEach((e, i) => tl.to(e.p, { v: 1, duration: 0.08, onUpdate: () => e.draw() }, 0.34 + Math.floor(i / 2) * 0.025 + (i % 2) * 0.01))
        world.leafNodes.forEach((n, i) => tl.to(n.group.scale, { ...pop, duration: 0.05 }, 0.41 + Math.floor(i / 2) * 0.025 + (i % 2) * 0.01))
        world.cross.forEach((e, i) => tl.to(e.p, { v: 1, duration: 0.1, onUpdate: () => e.draw() }, 0.62 + i * 0.03))
        tl.to(world.view, { zoom: 1, rot: 1, duration: 1 }, 0)
      }

      tl.to(bar.current, { scaleX: 1, duration: 1 }, 0)
      tl.to(hint.current, { opacity: 0, duration: 0.04 }, 0)

      // Text panels: each fades in/out inside its own window of the scroll.
      panels.current.forEach((el, i) => {
        const [from, to] = WINDOWS[i]
        if (i > 0) tl.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.04 }, from)
        if (i < WINDOWS.length - 1) tl.to(el, { opacity: 0, y: -30, duration: 0.04 }, to - 0.04)
      })
      gsap.set(panels.current.slice(1), { pointerEvents: 'none' })
      tl.set(panels.current[3], { pointerEvents: 'auto' }, 0.86)
    }, section)

    return () => {
      ctx.revert()
      world?.dispose()
    }
  }, [reduced])

  const stepCard = (s, i) => (
    <div
      key={s.q}
      ref={(el) => (panels.current[i] = el)}
      className={reduced ? 'rounded-2xl border border-white/10 bg-white/5 p-6' : 'col-start-1 row-start-1 rounded-2xl border border-white/10 bg-[#06100a]/75 p-6 backdrop-blur-md'}
      style={!reduced && i > 0 ? { opacity: 0 } : undefined}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-lime-300">
        {String(i + 1).padStart(2, '0')} / {String(STEPS.length).padStart(2, '0')} · {s.q}
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">{s.title}</h2>
      <p className="mt-3 text-base leading-7 text-lime-50/80">{s.text}</p>
      {i === STEPS.length - 1 && (
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild size="lg" className="bg-lime-300 text-[#06100a] hover:bg-lime-200"><Link to="/signup">Create your page</Link></Button>
          <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"><Link to="/login">Log in</Link></Button>
        </div>
      )}
    </div>
  )

  return (
    <section
      ref={section}
      aria-label="How a link tree grows"
      className={`relative overflow-hidden bg-[radial-gradient(80rem_40rem_at_50%_0%,#17361f,#06100a_70%)] text-white ${reduced ? '' : 'h-[calc(100svh-65px)]'}`}
    >
      <div ref={host} className={reduced ? 'h-[70vh] w-full' : 'absolute inset-0'} />

      {reduced ? (
        <div className="container grid gap-4 pb-16 sm:grid-cols-2">{STEPS.map(stepCard)}</div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-end md:items-center">
            <div className="container pb-10 md:pb-0">
              <div className="pointer-events-none grid max-w-md">{STEPS.map(stepCard)}</div>
            </div>
          </div>
          <p ref={hint} className="pointer-events-none absolute left-1/2 top-6 -translate-x-1/2 text-xs font-medium uppercase tracking-widest text-lime-100/80">
            Scroll to grow your tree ↓
          </p>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <div ref={bar} className="h-full origin-left scale-x-0 bg-lime-300" />
          </div>
        </>
      )}
    </section>
  )
}
