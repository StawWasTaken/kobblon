/*
 * The card drawn for a thing you wear, on its own.
 *
 * Staw: "the render doesnt work yet for clothing". A card for a shirt is a
 * body wearing the shirt, and there is no way to see whether that works
 * without an account, a database and something uploaded - so this draws one
 * from a picture made here, which is the same path `drawItemCard` takes for
 * a real one.
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { drawItemCard } from '@/lib/portrait'

/** A shirt template: front, back and sleeves in flat colours, labelled. */
const template = (() => {
  const sheet = document.createElement('canvas')
  sheet.width = 512
  sheet.height = 512
  const paint = sheet.getContext('2d')!
  paint.fillStyle = '#1b34e8'
  paint.fillRect(0, 0, 512, 512)
  paint.fillStyle = '#ffffff'
  paint.font = 'bold 64px sans-serif'
  paint.textAlign = 'center'
  paint.fillText('FRONT', 256, 280)
  return sheet.toDataURL('image/png')
})()

function Card({ kind, slot }: { kind: string; slot: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [trouble, setTrouble] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void (async () => {
      try {
        const drawn = await drawItemCard({ kind, slot, imageUrl: template, faceUrl: null })
        if (!live) return
        if (!drawn) { setTrouble('drawItemCard handed back nothing.'); return }
        setUrl(URL.createObjectURL(drawn))
      } catch (error) {
        if (live) setTrouble(String(error))
      }
    })()
    return () => { live = false }
  }, [kind, slot])

  return (
    <figure className="w-56">
      <div className="aspect-square rounded-2xl border border-ink-line bg-ink-card">
        {url
          ? <img src={url} alt="" className="h-full w-full object-contain" />
          : <p className="p-4 text-xs text-muted">{trouble ?? 'Drawing…'}</p>}
      </div>
      <figcaption className="mt-2 text-sm text-muted">{kind}</figcaption>
    </figure>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-10 text-white">
    <div className="flex flex-wrap gap-6">
      <Card kind="shirt" slot="shirt" />
      <Card kind="trousers" slot="trousers" />
      <Card kind="tdecal" slot="tdecal" />
    </div>
  </div>,
)
