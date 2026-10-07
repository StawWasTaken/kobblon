/*
 * The site's card picture, with its own version in its address.
 *
 * Staw pasted kobblon.com into Discord and got the *old* picture - the one
 * from before `og.png` was replaced. The file on the site was right, the tag
 * pointed at it, and Discord was serving what it fetched weeks ago, because
 * every platform that builds link previews caches the picture by its address
 * and `https://kobblon.com/brand/og.png` is the same address it has always
 * been. Nothing on our side can tell them to look again - there is no
 * refresh button we control - so the address has to change when the picture
 * does.
 *
 * So the picture is published under a name of its own making:
 * `/brand/og-<eight characters of its hash>.png`. A whole new path rather
 * than `?v=`, because Discord's proxy keys its copy on the address it
 * fetched and a query string is not reliably part of that - his debugger
 * output shows exactly that, a `proxy_url` holding our old picture under the
 * same old path. A new path has nothing cached against it anywhere.
 *
 * A date would re-fetch on days nothing changed; a hash is the picture's own
 * name for itself. `og.png` stays where it is for anything that links to it
 * by hand.
 *
 * Run after the build and before anything is published, so every page
 * written from the built shell carries it: the item cards are stamped into
 * the published index.html, so they inherit this without knowing about it.
 */
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { stamped as stampedName } from './stamped-names.mjs'

const PICTURE = 'public/brand/og.png'
const ADDRESS = 'https://kobblon.com/brand/og.png'

if (!existsSync(PICTURE)) {
  console.log('No card picture to stamp.')
  process.exit(0)
}

const stamp = createHash('sha256')
  .update(readFileSync(PICTURE))
  .digest('hex')
  .slice(0, 8)

const named = `og-${stamp}.png`
const stamped = `https://kobblon.com/brand/${named}`

// Beside the built one, so publishing carries it up with everything else in
// brand/. The unstamped name stays: anything that links to it by hand still
// gets a picture, it is only not the one the cards point at.
if (existsSync('dist/brand')) copyFileSync(PICTURE, `dist/brand/${named}`)

let changed = 0

for (const file of ['dist/index.html', 'dist/404.html']) {
  if (!existsSync(file)) continue
  const html = readFileSync(file, 'utf8')
  // Whatever name it currently carries, stamped or not.
  const next = html.replace(
    /https:\/\/kobblon\.com\/brand\/og(-[0-9a-f]+)?\.png(\?v=[0-9a-f]+)?/g,
    stamped,
  )
  if (next === html) continue
  writeFileSync(file, next)
  changed += 1
}

/*
 * The marks, for the same reason and worse - a favicon outlives an ordinary
 * reload. `site-pages.mjs` writes the stamped name into every page it makes;
 * this puts the file at that name and fixes the built shell those pages are
 * made from, so the two cannot disagree.
 */
for (const mark of ['brand/favicon.png', 'brand/favicon-create.png']) {
  if (!existsSync(`public/${mark}`)) continue
  const at = stampedName(mark)
  if (existsSync('dist/brand')) copyFileSync(`public/${mark}`, `dist${at}`)
  for (const file of ['dist/index.html', 'dist/404.html']) {
    if (!existsSync(file)) continue
    const html = readFileSync(file, 'utf8')
    const was = new RegExp(`/${mark.replace('.png', '')}(-[0-9a-f]+)?\\.png`, 'g')
    const next = html.replace(was, at)
    if (next !== html) writeFileSync(file, next)
  }
  console.log(`The mark is published as ${at.slice(1)}.`)
}

console.log(`The card picture is published as ${named} (${changed} file(s) stamped).`)
