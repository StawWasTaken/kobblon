/*
 * The three kinds of thing that have no saved card, drawn.
 *
 * Staw: "body parts dont have 2d previews" and "accessories' previews dont
 * load properly either". Both are the same absence - `cardFor` is null for
 * a body part and for an accessory nobody has drawn a card for - and the
 * answer to both is `wornCard`, which draws the thing here and now.
 *
 * Nothing around it: no provider, no router, no database. The model is the
 * rig itself, which is the one mesh this repository ships, so the accessory
 * column is a drawing of a real file rather than of a stub.
 */
import { createRoot } from 'react-dom/client'
import { WornPicture } from '@/components/catalog/WornPicture'
import '@/index.css'

const sheet = (colour: string) => `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="585" height="559">`
  + `<rect width="585" height="559" fill="${colour}"/>`
  + `<rect x="60" y="60" width="465" height="200" fill="#ffffff" opacity="0.3"/></svg>`,
)}`

const things = [
  {
    note: 'Body part, from its shape',
    item: { id: 'a', kind: 'bodypart', slot: 'torso', shape: 'torso-girl' },
  },
  {
    note: 'Accessory, from its model',
    item: { id: 'b', kind: 'accessory', slot: 'hat', meshUrl: '/k6/k6.glb', mesh_format: 'gltf' },
  },
  {
    note: 'Shirt, from its sheet',
    item: { id: 'c', kind: 'shirt', slot: 'shirt', imageUrl: sheet('#2f6df6') },
  },
  {
    note: 'Nothing to draw from',
    item: { id: 'd', kind: 'accessory', slot: 'hat' },
  },
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-8 text-white">
    <div className="grid grid-cols-4 gap-4">
      {things.map((one) => (
        <div key={one.item.id}>
          <div className="aspect-square rounded-xl border-2 border-ink-line bg-ink-card p-3">
            <WornPicture item={one.item} alt={one.note} />
          </div>
          <p className="mt-2 text-xs text-muted">{one.note}</p>
        </div>
      ))}
    </div>
  </div>,
)
