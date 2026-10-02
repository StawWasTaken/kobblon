/*
 * The mesh viewer with nothing around it, on an OBJ wearing a Decal.
 *
 * An OBJ because that is the format with no materials of its own, so this
 * shows both halves at once: the reader that has to invent a material, and
 * the Decal being put onto it. A glTF would have hidden a failure in either.
 */
import { createRoot } from 'react-dom/client'
import { MeshViewer } from '@/components/create/MeshViewer'
import { MeshView } from '@/components/create/MeshView'
import '@/index.css'

// A cube with texture coordinates, written out by hand so the page needs no
// file beside it.
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

/*
 * The same cube with every `vt` line and every `/n` taken off: an OBJ
 * exported without texture coordinates, which is the common case and the one
 * that used to render as a single flat colour.
 */
const BARE = CUBE.replace(/^vt .*$/gm, '').replace(/\/\d+/g, '')
const bareUrl = URL.createObjectURL(new Blob([BARE], { type: 'text/plain' }))

/** A Decal that is obviously a Decal: unmistakable if it lands wrong. */
function decal() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const brush = canvas.getContext('2d')!
  brush.fillStyle = '#1b6fd6'
  brush.fillRect(0, 0, 256, 256)
  brush.fillStyle = '#1cae71'
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      if ((x + y) % 2 === 0) brush.fillRect(x * 32, y * 32, 32, 32)
    }
  }
  brush.fillStyle = '#fff'
  brush.font = 'bold 64px sans-serif'
  brush.textAlign = 'center'
  brush.fillText('KOB', 128, 150)
  return canvas.toDataURL('image/png')
}
const textureUrl = decal()

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-8 text-white">
    <h1 className="font-display text-xl">A mesh, with no website around it</h1>
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">OBJ, wearing a Decal</p>
        <MeshViewer src={objUrl} format="obj" textureUrl={textureUrl} />
      </div>
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">OBJ, undressed</p>
        <MeshViewer src={objUrl} format="obj" />
      </div>
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">A file that is not a mesh</p>
        <MeshViewer src="data:text/plain,nonsense" format="obj" />
      </div>
    </div>

    <h1 className="font-display text-xl">No texture coordinates at all</h1>
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">
          Given some, so the Decal shows
        </p>
        <MeshViewer src={bareUrl} format="obj" textureUrl={textureUrl} />
      </div>
    </div>

    <h1 className="font-display text-xl">Both views, and the switch</h1>
    <div className="grid gap-6 sm:grid-cols-3">
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">
          A card: the picture, until asked
        </p>
        <MeshView previewUrl={textureUrl} fileUrl={objUrl} filePath="a.obj" />
      </div>
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">
          An item page: turning, from the start
        </p>
        <MeshView
          start="3d"
          labelled
          previewUrl={textureUrl}
          fileUrl={objUrl}
          filePath="a.obj"
          textureUrl={textureUrl}
        />
      </div>
      <div className="space-y-2">
        <p className="font-display text-xs uppercase tracking-wider text-muted">
          No picture drawn: no switch offered
        </p>
        <MeshView start="3d" fileUrl={objUrl} filePath="a.obj" textureUrl={textureUrl} />
      </div>
    </div>
  </div>,
)
