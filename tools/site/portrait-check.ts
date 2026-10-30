/*
 * Does a head wearing something come out of `drawPortrait` wearing it?
 *
 * Staw saw hair on an avatar and no hair on the same person's profile
 * picture. Both sides dress through `dressFrom`, so the question is whether
 * the headshot frame actually contains what is on the head - and the way to
 * find that out is to draw one and look at it, in the head frame and in the
 * body frame, side by side.
 *
 * The K6 body itself stands in for a hair mesh: it is the one model that is
 * certainly here, and what is being asked is whether a thing hung on the
 * hair socket is in the picture, not whether it is pretty.
 */
import { drawPortrait, type PortraitLook } from '@/lib/portrait'
import { socketFor, type Missing } from '@/engine'

const piece = {
  slot: 'hair',
  point: socketFor('hair'),
  itemId: 'x', kind: 'hair', name: 'Hair', contentId: 1,
  cardUrl: null, price: null, imageUrl: null,
  meshUrl: '/k6/k6.glb', meshFormat: 'gltf',
  textureUrl: null, fit: null, shape: null, sellsUntil: null,
}

const look = { body: null, pieces: [piece] } as unknown as PortraitLook
const bare = { body: null, pieces: [] } as unknown as PortraitLook

const out = document.getElementById('out')!

async function show(label: string, blob: Blob | null) {
  const box = document.createElement('figure')
  box.style.cssText = 'display:inline-block;margin:0 16px 16px 0;text-align:center'
  const caption = document.createElement('figcaption')
  caption.textContent = label + (blob ? '' : ' - nothing drawn')
  if (blob) {
    const img = document.createElement('img')
    img.src = URL.createObjectURL(blob)
    img.width = 256
    img.style.cssText = 'background:#1b1b1f;border-radius:12px'
    box.append(img)
  }
  box.append(caption)
  out.append(box)
}

out.textContent = ''
await show('head, nothing on', await drawPortrait(bare, '/k6/k6.glb', 'head'))
await show('head, hair socket', await drawPortrait(look, '/k6/k6.glb', 'head'))
await show('body, hair socket', await drawPortrait(look, '/k6/k6.glb', 'body'))

/*
 * And the case the saving rule turns on: a piece whose file is not there.
 * The picture still draws - that is what was happening all along - and the
 * difference is that it now says so.
 */
const broken = {
  body: null,
  pieces: [{ ...piece, meshUrl: '/k6/there-is-no-such-file.glb' }],
} as unknown as PortraitLook

const lost: Missing[] = []
await show('head, model that is not there',
  await drawPortrait(broken, '/k6/k6.glb', 'head', (miss) => lost.push(miss)))

const said = document.createElement('pre')
said.textContent = lost.length
  ? lost.map((one) => `missing  ${one.piece.slot}: ${one.why} (passing: ${one.passing})`).join('\n')
  : 'FAIL: nothing was reported missing'
said.style.cssText = 'color:' + (lost.length ? '#8ee6a8' : '#ff8080')
out.append(said)
