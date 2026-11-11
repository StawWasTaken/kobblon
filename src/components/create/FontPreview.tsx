import { useEffect, useState } from 'react'
import { Skeleton } from '@/components/ui/States'

const SAMPLE = 'The quick brown fox jumps over the lazy dog'

/**
 * A font is only worth looking at in its own shapes, so the file is loaded
 * and the sample is set in it. If it will not load, the sample is still
 * readable, just in the interface font.
 */
export function FontPreview({ src, name }: { src: string | null; name: string }) {
  const [family, setFamily] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!src) return
    let live = true
    const family = `kob-preview-${Math.random().toString(36).slice(2, 8)}`
    const face = new FontFace(family, `url(${JSON.stringify(src)})`)

    face.load()
      .then((loaded) => {
        if (!live) return
        document.fonts.add(loaded)
        setFamily(family)
      })
      .catch(() => { if (live) setFailed(true) })

    return () => {
      live = false
      document.fonts.delete(face)
    }
  }, [src])

  if (!src) return <Skeleton className="h-20" />

  return (
    <div className="rounded-xl border-2 border-b-4 border-ink-line bg-ink-raised px-5 py-8">
      <p
        className="break-words text-2xl leading-relaxed sm:text-3xl"
        style={family ? { fontFamily: family } : undefined}
        lang="en"
      >
        {SAMPLE}
      </p>
      {failed && (
        <p className="mt-3 text-xs text-muted">
          This font could not be loaded for preview, so {name} is shown in the interface font.
        </p>
      )}
    </div>
  )
}
