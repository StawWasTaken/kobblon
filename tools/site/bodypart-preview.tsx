/*
 * A body part, on the body, next to the body without it.
 *
 * The one thing worth looking at here is whether the shape stays inside the
 * box its clothes are measured against - so the same shirt is on both, and
 * if the shape has left its box it is the shirt that shows it.
 */
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import '@/index.css'
import { K6, loadK6Source, templateFor } from '@/engine'
import { MANNEQUIN_BODY } from '@/lib/mannequin'

function shirt() {
  const sheet = templateFor('shirt')
  const canvas = document.createElement('canvas')
  canvas.width = sheet.width
  canvas.height = sheet.height
  const brush = canvas.getContext('2d')!
  for (const [name, r] of Object.entries(sheet.regions)) {
    const side = name.split('.')[1]
    brush.fillStyle = side === 'front' ? '#1b34e8'
      : side === 'back' ? '#162382' : '#3A50FF'
    brush.fillRect(r.x, r.y, r.w, r.h)
  }
  const made = new THREE.CanvasTexture(canvas)
  made.colorSpace = THREE.SRGBColorSpace
  return made
}

function Stand({ shape, dressed }: { shape: string | null; dressed: boolean }) {
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = box.current
    if (!host) return
    let alive = true
    let renderer: THREE.WebGLRenderer | null = null

    void (async () => {
      const body = new K6(await loadK6Source('/k6/k6.glb'))
      if (!alive) return
      body.paint(MANNEQUIN_BODY)
      if (shape) body.setShape('Torso', shape)
      {
        const torso = (body as unknown as { parts: Map<string, THREE.Mesh> }).parts.get('Torso')!
        const at = torso.geometry.getAttribute('position') as THREE.BufferAttribute
        const rows = new Map<number, number>()
        for (let i = 0; i < at.count; i += 1) {
          const y = Math.round(at.getY(i) * 4) / 4
          rows.set(y, Math.max(rows.get(y) ?? 0, Math.abs(at.getX(i))))
        }
        console.log(shape ?? 'plain', [...rows.entries()].sort((a, b) => a[0] - b[0])
          .map(([y, x]) => `${y}:${x.toFixed(2)}`).join(' '))
      }
      if (dressed) body.dress('shirt', shirt())

      const scene = new THREE.Scene()
      scene.add(body.object)
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8d95a6, 2.0))
      const sun = new THREE.DirectionalLight(0xffffff, 2.2)
      sun.position.set(4, 10, 8)
      scene.add(sun)

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      renderer.setClearColor(0x000000, 0)
      renderer.setSize(360, 460, false)
      host.appendChild(renderer.domElement)

      const camera = new THREE.PerspectiveCamera(28, 360 / 460, 0.1, 200)
      const seen = new THREE.Box3().setFromObject(body.object)
      const middle = seen.getCenter(new THREE.Vector3())
      const tall = seen.max.y - seen.min.y
      camera.position.set(0, middle.y, (tall / 2) / Math.tan((28 * Math.PI) / 360) * 1.25)
      camera.position.x = camera.position.z * 0.25
      camera.lookAt(middle)
      renderer.render(scene, camera)
    })()

    return () => { alive = false; renderer?.dispose() }
  }, [shape, dressed])

  return <div ref={box} className="rounded-2xl bg-ink-card" />
}

function Page() {
  const [dressed, setDressed] = useState(
    new URLSearchParams(window.location.search).has('dressed'),
  )
  return (
    <div className="min-h-screen bg-ink p-8 text-white">
      <button
        onClick={() => setDressed((v) => !v)}
        className="mb-5 rounded-lg border border-ink-line px-3 py-1.5 text-sm font-bold"
      >
        {dressed ? 'Take the shirt off' : 'Put a shirt on both'}
      </button>
      <div className="flex gap-6">
        <figure>
          <Stand shape={null} dressed={dressed} />
          <figcaption className="mt-2 text-sm text-muted">The plain block</figcaption>
        </figure>
        <figure>
          <Stand shape="torso-girl" dressed={dressed} />
          <figcaption className="mt-2 text-sm text-muted">torso-girl</figcaption>
        </figure>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Page />)
