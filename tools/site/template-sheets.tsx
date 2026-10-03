/*
 * The clothing templates, drawn here rather than kept by hand.
 *
 * `public/templates/*.png` is what a person downloads to paint a shirt on,
 * so it has to describe the body the wrapping actually reads. The first pair
 * was drawn once and committed, and the moment `BODY` changed - legs and
 * arms to the torso's width, a rounded cylinder for a head - the files on
 * disk described a body that no longer exists.
 *
 * So this page draws them from `templateFor` and hands them over as PNGs.
 * Run it, save both, commit them. It is also the honest check that a region
 * table is laid out the way somebody painting into it would expect.
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useRef } from 'react'
import { drawTemplate, templateFor, type Clothing } from '@/engine/clothes'

const KINDS: Clothing[] = ['shirt', 'trousers']

function Sheet({ kind }: { kind: Clothing }) {
  const holder = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = drawTemplate(templateFor(kind), document.createElement('canvas'))
    const box = holder.current
    if (!box) return
    box.textContent = ''
    canvas.style.background = '#101322'
    canvas.style.imageRendering = 'pixelated'
    box.append(canvas)

    const link = document.createElement('a')
    link.textContent = `Save kobblon-${kind}-template.png (${canvas.width}x${canvas.height})`
    link.href = canvas.toDataURL('image/png')
    link.download = `kobblon-${kind}-template.png`
    link.id = `save-${kind}`
    link.style.cssText = 'display:block;margin:8px 0;color:#7aa2ff;font:14px system-ui'
    box.append(link)
  }, [kind])

  return (
    <section style={{ margin: 24, font: '14px system-ui', color: 'white' }}>
      <h2 style={{ textTransform: 'capitalize' }}>{kind}</h2>
      <div ref={holder} />
    </section>
  )
}

createRoot(document.getElementById('root')!).render(
  <div style={{ background: '#0b0d18', minHeight: '100vh' }}>
    {KINDS.map((kind) => <Sheet key={kind} kind={kind} />)}
  </div>,
)
