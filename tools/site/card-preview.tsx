/*
 * A Marketplace card with nothing around it.
 *
 * Here because the two faults it exists to catch are both about what a card
 * is *inside*: it is a link, and a link is a drag source, so turning a model
 * on one used to drag the card itself. And its two views have to be the same
 * frame, or pressing the switch moves the layout.
 */
import { MemoryRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { AssetTile } from '@/components/create/AssetTile'
import { MeshView } from '@/components/create/MeshView'
import '@/index.css'

const CUBE = `
v -1 -1  1
v  1 -1  1
v  1  1  1
v -1  1  1
v -1 -1 -1
v  1 -1 -1
v  1  1 -1
v -1  1 -1
vt 0 0
vt 1 0
vt 1 1
vt 0 1
f 1/1 2/2 3/3
f 1/1 3/3 4/4
f 6/1 5/2 8/3
f 6/1 8/3 7/4
f 2/1 6/2 7/3
f 2/1 7/3 3/4
f 5/1 1/2 4/3
f 5/1 4/3 8/4
f 4/1 3/2 7/3
f 4/1 7/3 8/4
f 5/1 6/2 2/3
f 5/1 2/3 1/4
`
const objUrl = URL.createObjectURL(new Blob([CUBE], { type: 'text/plain' }))

function skin() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const brush = canvas.getContext('2d')!
  brush.fillStyle = '#1b6fd6'
  brush.fillRect(0, 0, 256, 256)
  brush.fillStyle = '#1cae71'
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) if ((x + y) % 2 === 0) brush.fillRect(x * 32, y * 32, 32, 32)
  }
  brush.fillStyle = '#fff'
  brush.font = 'bold 64px sans-serif'
  brush.textAlign = 'center'
  brush.fillText('KOB', 128, 150)
  return canvas.toDataURL('image/png')
}
const picture = skin()

const item = {
  id: 'a', kind: 'mesh' as const, name: 'A mesh on a card', description: null,
  file_path: 'x/a.obj', thumbnail_path: null, preview_path: null,
  download_count: 3, content_id: 1176, price: 0, score: null, votes: 0,
  created_at: new Date().toISOString(), creator_username: 'kobblon',
  creator_display_name: 'Kobblon', creator_avatar_url: null, creator_is_admin: true,
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-screen space-y-8 bg-ink p-8 text-white">
      <h1 className="font-display text-xl">A card, and the frame both views share</h1>
      <div className="grid w-[760px] grid-cols-3 gap-4">
        <AssetTile item={item} />
        <div className="space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">Picture</p>
          <MeshView previewUrl={picture} fileUrl={objUrl} filePath="a.obj" />
        </div>
        <div className="space-y-2">
          <p className="font-display text-[10px] uppercase tracking-wider text-muted">Turning</p>
          <MeshView
            start="3d"
            labelled
            previewUrl={picture}
            fileUrl={objUrl}
            filePath="a.obj"
            textureUrl={picture}
          />
        </div>
      </div>

      <h2 className="font-display text-sm uppercase tracking-wider text-muted">
        A turn is not a press, and a press is still a press
      </h2>
      <a
        href="#counted"
        id="probe"
        draggable={false}
        onClick={(e) => {
          e.preventDefault()
          const at = document.getElementById('count')!
          at.textContent = String(Number(at.textContent) + 1)
        }}
        className="block w-[240px]"
      >
        <MeshView start="3d" previewUrl={picture} fileUrl={objUrl} filePath="a.obj" />
      </a>
      <p className="text-sm">
        clicks that got through: <span id="count">0</span>
      </p>
    </div>
  </MemoryRouter>,
)
