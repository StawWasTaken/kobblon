/*
 * The fitting view and its editor, with nothing around them.
 *
 * Both are shared pieces - the create dialog, a made card and the Workspace
 * all place accessories - so both have to mount with no provider, no router
 * and no database.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AvatarStage } from '@/components/avatar/AvatarStage'
import { FitEditor, PLAIN_FIT, fitIsPlain } from '@/components/avatar/FitEditor'
import { plainFace } from '@/lib/plainFace'
import type { WornFit } from '@/engine'
import '@/index.css'

/** A hat drawn six stons off its own origin, as an uploaded one would be. */
function wonkyHat() {
  const away = 6
  const size = 10
  const points: string[] = []
  for (const x of [0, size]) {
    for (const y of [0, size * 0.6]) {
      for (const z of [0, size]) points.push(`v ${x + away} ${y} ${z}`)
    }
  }
  const faces = [
    [1, 2, 4, 3], [5, 7, 8, 6], [1, 5, 6, 2],
    [3, 4, 8, 7], [1, 3, 7, 5], [2, 6, 8, 4],
  ]
  const text = [...points, ...faces.map((f) => `f ${f.join(' ')}`)].join('\n')
  return URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
}

const MESH = wonkyHat()

function Fitting() {
  const [fit, setFit] = useState<Required<WornFit>>(PLAIN_FIT)
  return (
    <div className="w-80 space-y-2">
      <div className="overflow-hidden rounded-xl border border-ink-line bg-ink-raised">
        <AvatarStage
          look={{
            body: {
              Head: '#f2d08a', Torso: '#2a2f45', LeftArm: '#f2d08a',
              RightArm: '#f2d08a', LeftLeg: '#1b1d28', RightLeg: '#1b1d28',
            },
            pieces: [
              { slot: 'face', kind: 'face', imageUrl: plainFace() },
              { slot: 'hat', kind: 'accessory', meshUrl: MESH, meshFormat: 'obj', fit },
            ],
          }}
          turning={false}
          handled
          className="aspect-square w-full"
        />
      </div>
      <FitEditor
        value={fit}
        onChange={setFit}
        onReset={fitIsPlain(fit) ? undefined : () => setFit(PLAIN_FIT)}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-8 text-white">
    <Fitting />
  </div>,
)
