/*
 * A picture's own name for itself.
 *
 * The card picture already does this (see `stamp-card-picture.mjs`), and the
 * favicon needs it for the same reason and worse: Staw replaced the mark,
 * the file on the site was right, the tag pointed at it, and the browser
 * kept showing the old one. A favicon is cached harder than anything else a
 * page loads - an ordinary reload does not touch it, and on a site behind a
 * CDN neither does a hard one, reliably. There is no refresh button we
 * control, so the address has to change when the picture does.
 *
 * Both the stamping script and the page writer need the same answer, and if
 * they ever disagree every page points at a file that is not there. So they
 * ask here instead of each computing it.
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'

/** `brand/favicon.png` -> `brand/favicon-1a2b3c4d.png`, or unchanged. */
export function stamped(path) {
  const source = `public/${path}`
  if (!existsSync(source)) return `/${path}`
  const mark = createHash('sha256').update(readFileSync(source)).digest('hex').slice(0, 8)
  return `/${path.replace(/\.png$/, `-${mark}.png`)}`
}
