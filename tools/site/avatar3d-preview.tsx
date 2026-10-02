/*
 * The avatar, drawn, with no website around it.
 *
 * `AvatarStage` is shared: the editor, a profile and the shot a profile
 * picture is taken from all use it, and so will the Workspace. So it has to
 * mount with no provider, no router and no database - which is exactly what
 * this page gives it. Everything it is handed here is drawn in the browser,
 * because this container cannot reach storage.
 */
import { createRoot } from 'react-dom/client'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { templateFor } from '@/engine'
import '@/index.css'

/** A shirt drawn into the real template, so the wrap is the real wrap. */
function shirt() {
  const sheet = templateFor('shirt')
  const canvas = document.createElement('canvas')
  canvas.width = sheet.width
  canvas.height = sheet.height
  const brush = canvas.getContext('2d')!
  brush.clearRect(0, 0, canvas.width, canvas.height)
  for (const [name, r] of Object.entries(sheet.regions)) {
    const side = name.split('.')[1]
    brush.fillStyle = side === 'front' ? '#1b34e8'
      : side === 'back' ? '#162382' : '#2a3bb8'
    brush.fillRect(r.x, r.y, r.w, r.h)
  }
  // A collar, so it is obviously a shirt and obviously the right way up.
  const front = sheet.regions['Torso.front']
  brush.fillStyle = '#f4f6ff'
  brush.fillRect(front.x + front.w * 0.3, front.y, front.w * 0.4, front.h * 0.12)
  return canvas.toDataURL('image/png')
}

function face() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const b = c.getContext('2d')!
  b.clearRect(0, 0, 256, 256)
  b.fillStyle = '#1a1a22'
  b.beginPath(); b.ellipse(90, 100, 15, 21, 0, 0, 7); b.fill()
  b.beginPath(); b.ellipse(166, 100, 15, 21, 0, 0, 7); b.fill()
  b.lineWidth = 11; b.strokeStyle = '#1a1a22'; b.lineCap = 'round'
  b.beginPath(); b.arc(128, 138, 44, 0.3, Math.PI - 0.3); b.stroke()
  return c.toDataURL('image/png')
}

function sticker() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const b = c.getContext('2d')!
  b.clearRect(0, 0, 256, 256)
  b.fillStyle = '#ff0033'
  b.beginPath(); b.arc(128, 128, 86, 0, 7); b.fill()
  b.fillStyle = '#fff'
  b.font = 'bold 64px system-ui'
  b.textAlign = 'center'
  b.fillText('KOB', 128, 150)
  return c.toDataURL('image/png')
}

const bare: AvatarLook = { body: null, pieces: [] }

const painted: AvatarLook = {
  body: { Head: '#f2d08a', Torso: '#2a2f45', LeftArm: '#f2d08a',
    RightArm: '#f2d08a', LeftLeg: '#1b1d28', RightLeg: '#1b1d28' },
  pieces: [],
}

const dressed: AvatarLook = {
  body: painted.body,
  pieces: [
    { slot: 'shirt', kind: 'shirt', imageUrl: shirt() },
    { slot: 'face', kind: 'face', imageUrl: face() },
    { slot: 'tdecal', kind: 'tdecal', imageUrl: sticker() },
  ],
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-8 text-white">
    <h1 className="font-display text-xl">An avatar, with no website around it</h1>
    <div className="grid w-[1000px] grid-cols-4 gap-5">
      {([
        ['Nothing on', bare, false],
        ['Coloured', painted, false],
        ['Dressed', dressed, false],
        ['The profile picture', dressed, true],
      ] as const).map(([label, look, portrait]) => (
        <div key={label} className="space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">
            {label}
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
            <AvatarStage look={look} portrait={portrait} turning={false} />
          </div>
        </div>
      ))}
    </div>
  </div>,
)
