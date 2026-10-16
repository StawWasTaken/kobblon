/*
 * The card a body part gets, drawn by the same `drawItemCard` the Catalog
 * saves - on its own, with no session and no database.
 *
 * It is here because a body part is the one kind with no picture of its
 * own: if the drawing fails, the shelf has nothing to fall back to, and the
 * only way to know is to look at the thing it draws.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { drawItemCard } from '@/lib/portrait'
import { plainFace } from '@/lib/plainFace'

function Card({ shape, label }: { shape: string | null; label: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let live = true
    void drawItemCard({
      kind: shape ? 'bodypart' : 'shirt',
      slot: shape ? 'torso' : 'shirt',
      shape,
      imageUrl: shape ? null : '/templates/kobblon-shirt-template.png',
      faceUrl: plainFace(),
    }).then((blob) => {
      if (!live) return
      setUrl(blob ? URL.createObjectURL(blob) : null)
      setDone(true)
    })
    return () => { live = false }
  }, [shape])

  return (
    <figure className="w-[260px]">
      <div className="grid aspect-square place-items-center rounded-2xl bg-ink-card">
        {url
          ? <img src={url} alt={label} className="h-full w-full object-contain" />
          : <span className="text-xs text-muted">{done ? 'nothing came back' : 'drawing'}</span>}
      </div>
      <figcaption className="mt-2 text-sm text-muted">{label}</figcaption>
    </figure>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-8 text-white">
    <div className="flex gap-6">
      <Card shape="torso-girl" label="Waisted Torso, as a card" />
      <Card shape={null} label="A shirt's card, for the framing" />
    </div>
  </div>,
)
