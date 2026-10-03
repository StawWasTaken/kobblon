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
import { useState } from 'react'
import { AvatarStage, type AvatarLook } from '@/components/avatar/AvatarStage'
import { BodyPicker } from '@/components/avatar/BodyPicker'
import type { BodyPart } from '@/engine'
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

/*
 * A hat modelled badly on purpose: a box drawn six stons to one side of its
 * own origin and ten times too big, which is what an uploaded accessory
 * really looks like. If it lands on the head, `fitToSocket` is doing both of
 * its jobs - the size and, the one that was missing, the position.
 */
function wonkyHat() {
  const away = 6
  const size = 10
  const points: string[] = []
  for (const x of [0, size]) {
    for (const y of [0, size * 0.6]) {
      for (const z of [0, size]) points.push(`v ${x + away} ${y} ${z}`)
    }
  }
  // The eight corners above, in the order OBJ counts them from one.
  const faces = [
    [1, 2, 4, 3], [5, 7, 8, 6], [1, 5, 6, 2],
    [3, 4, 8, 7], [1, 3, 7, 5], [2, 6, 8, 4],
  ]
  const text = [...points, ...faces.map((f) => `f ${f.join(' ')}`)].join('\n')
  return URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
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

const hatted: AvatarLook = {
  body: painted.body,
  pieces: [
    { slot: 'face', kind: 'face', imageUrl: face() },
    {
      slot: 'hat', kind: 'accessory',
      meshUrl: wonkyHat(), meshFormat: 'obj', textureUrl: sticker(),
    },
  ],
}

/** The flat body you press to choose what a colour would paint. */
function Picker() {
  const [chosen, setChosen] = useState<BodyPart[]>(['Torso', 'LeftArm', 'RightArm'])
  return (
    <div className="w-44 rounded-xl border border-ink-line bg-ink-raised p-3">
      <BodyPicker
        colours={painted.body!}
        chosen={chosen}
        onChoose={(one) => setChosen((had) => (
          had.includes(one)
            ? had.length > 1 ? had.filter((x) => x !== one) : had
            : [...had, one]
        ))}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-8 text-white">
    <h1 className="font-display text-xl">An avatar, with no website around it</h1>
    <div className="grid w-[1200px] grid-cols-5 gap-5">
      {([
        ['Nothing on', bare, false],
        ['Coloured', painted, false],
        ['Dressed, and draggable', dressed, false],
        ['The profile picture', dressed, true],
        ['A badly modelled hat', hatted, false],
      ] as const).map(([label, look, portrait]) => (
        <div key={label} className="space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">
            {label}
          </p>
          <div className="overflow-hidden rounded-2xl border border-ink-line bg-ink-raised">
            <AvatarStage
              look={look}
              portrait={portrait}
              turning={false}
              handled={label.includes('draggable')}
            />
          </div>
        </div>
      ))}
    </div>

    <div className="space-y-2">
      <p className="font-display text-[10px] uppercase tracking-wider text-muted">
        The body, as a thing you press
      </p>
      <Picker />
    </div>
  </div>,
)
