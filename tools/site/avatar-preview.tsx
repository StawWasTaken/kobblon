/*
 * The avatar page's own parts, drawn against stubbed answers.
 *
 * This container cannot reach the database, so the page itself cannot be
 * loaded with real rows. What can be checked without one is the part that
 * actually decides whether this page works: that `FaceStage` puts a hat
 * where the person who made it dragged it, at any size, and that the same
 * placement lands identically on a stamp and on a portrait - which is the
 * whole promise the avatar makes to every card on the site.
 */
import { createRoot } from 'react-dom/client'
import { FaceStage } from '@/components/style/FaceStage'
import type { WornStyle } from '@/types/db'
import '@/index.css'

/** A face and two things on it, drawn rather than fetched. */
function paint(colour: string, draw: (b: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const b = c.getContext('2d')!
  b.fillStyle = colour
  draw(b)
  return c.toDataURL('image/png')
}

const face = paint('#c98d5a', (b) => {
  b.fillRect(0, 0, 256, 256)
  b.fillStyle = '#1b1c22'
  b.beginPath(); b.arc(92, 110, 14, 0, 7); b.fill()
  b.beginPath(); b.arc(164, 110, 14, 0, 7); b.fill()
  b.fillRect(96, 168, 64, 10)
})

// A hat, in front, near the top. A badge, behind, off to one side.
const hat = paint('#1b6fd6', (b) => { b.fillRect(28, 150, 200, 70); b.fillRect(0, 206, 256, 40) })
const halo = paint('#1cae71', (b) => { b.beginPath(); b.arc(128, 128, 126, 0, 7); b.fill() })

const worn: WornStyle[] = [
  { id: 'halo', name: 'Halo', url: halo, x: 0.5, y: 0.5, width: 1.25, layer: 0 },
  { id: 'hat', name: 'Hat', url: hat, x: 0.5, y: 0.22, width: 0.9, rotation: -6, layer: 1 },
]

const sizes = [
  { label: 'Stamp — a comment', px: 40 },
  { label: 'Card', px: 96 },
  { label: 'Profile', px: 180 },
  { label: 'The avatar page', px: 288 },
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-8 bg-ink p-8 text-white">
    <h1 className="font-display text-xl">One placement, every size</h1>
    <div className="flex flex-wrap items-end gap-8">
      {sizes.map((one) => (
        <div key={one.px} className="space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">{one.label}</p>
          <div style={{ width: one.px }}>
            <FaceStage src={face} name="Someone" items={worn} className="w-full" />
          </div>
        </div>
      ))}
    </div>

    <div className="space-y-2">
      <p className="font-display text-[10px] uppercase tracking-wider text-muted">
        Bare face, for comparison
      </p>
      <div style={{ width: 180 }}>
        <FaceStage src={face} name="Someone" items={[]} className="w-full" />
      </div>
    </div>
  </div>,
)
