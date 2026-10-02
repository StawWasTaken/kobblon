import { useEffect, useState } from 'react'
import { assetUrl, previewUrl, isAssetRef, resolveAssetRef } from '@/lib/api'

/**
 * Uploads are not publicly addressable, so a preview needs a signed URL that
 * expires. This asks for one and keeps it for as long as the thing is on
 * screen.
 */
export function useSignedUrl(path?: string | null) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    if (!path) { setUrl(null); return }
    assetUrl(path).then((next) => { if (live) setUrl(next) }).catch(() => {})
    return () => { live = false }
  }, [path])

  return url
}

/**
 * Takes whatever was stored for a picture. Emblems, covers, avatars and
 * thumbnails are ordinary uploads and come back untouched. A "kob://IMG-1042"
 * reference is Create content used inside a Space, and is resolved to a
 * short-lived link. Both forms go through here so a picture never has to
 * know which it is.
 */
export function useAssetRef(value?: string | null) {
  const [url, setUrl] = useState<string | null>(isAssetRef(value) ? null : value ?? null)

  useEffect(() => {
    let live = true
    if (!value) { setUrl(null); return }
    if (!isAssetRef(value)) { setUrl(value); return }
    setUrl(null)
    resolveAssetRef(value).then((next) => { if (live) setUrl(next) }).catch(() => {})
    return () => { live = false }
  }, [value])

  return url
}

/**
 * The picture for a piece of content, from whichever place holds it.
 *
 * There are three, and they are not interchangeable:
 *
 *   * `preview_path` is the card drawn at upload. It is in the public
 *     `previews` bucket and is addressed directly - signing it is signing
 *     for a file that is not in the bucket you are signing against, which
 *     404s. That mistake broke every card on the site once.
 *   * `thumbnail_path` is the older one, in the private `uploads` bucket,
 *     and has to be signed for. Nothing writes to it any more, so it is only
 *     ever what something uploaded years ago still has.
 *   * a Decal's own file, which is in `uploads` too and *is* the picture, so
 *     it stands in when there is no card.
 *
 * Preferring the newest is what makes a freshly drawn card appear; keeping
 * the other two is what stops everything older from going blank.
 */
export function usePictureUrl(item: {
  preview_path?: string | null
  thumbnail_path?: string | null
  file_path?: string | null
  kind?: string | null
}) {
  const direct = previewUrl(item.preview_path)
  const signed = useSignedUrl(
    direct ? null : item.thumbnail_path ?? (item.kind === 'image' ? item.file_path : null),
  )
  return direct ?? signed
}
