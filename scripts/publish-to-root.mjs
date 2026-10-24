// Copies the build into the repository root, which is what GitHub Pages
// publishes when its source is a branch. Run by the deploy workflow after
// `npm run build`; `npm run deploy` does both by hand.
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { pageRoots } from './site-pages.mjs'

// The addresses that point at something get their own files too, written
// by write-item-pages.mjs before this runs.
// `worlds`, not `s`: a World's address moved, write-item-pages writes cards
// under the new one, and this list is what actually gets published - so
// leaving `s` here published nothing for Worlds and kept the old cards,
// which point at an address that redirects to Discover.
// `catalog` is here because the Catalog is the thing people paste: without
// it, cards were written into dist/catalog and then not published, which is
// a card that exists and that nobody is ever served. `style` stays only to
// keep clearing the dead ones out; nothing writes there any more.
const itemRoots = ['worlds', 'c', 'u', 'e', 'catalog', 'style']

/**
 * Roots that hold item cards as well as pages written from site-pages.mjs.
 *
 * `forum` belongs here and was missing, which is the same bug this file
 * already documents further down, happening to a root nobody had added.
 * Topic and profile cards are written under `forum/t/` and `forum/u/` by
 * `write-item-pages`, and the forum's own page comes from `site-pages` - so
 * `forum` was in `built` but not in this list, and every deploy from a
 * machine that could not reach the database deleted every forum card on the
 * site on its way past. It was found by a pull: the cards kept coming back
 * as conflicts because the other end of the repository still had them.
 */
const itemBearing = [...itemRoots, 'create', 'forum']

/*
 * Everything in public/ is served as it stands, so everything in public/ is
 * published. Listing it rather than naming it is deliberate: the avatar and
 * the first World's manifest were both added to public/ and neither was added
 * here, so both answered in development and 404ed on the site.
 */
const staticRoots = existsSync('public') ? readdirSync('public') : []

const built = [
  'index.html', '404.html', 'assets',
  ...staticRoots,
  ...pageRoots,
  ...itemRoots,
].filter((name, at, all) => all.indexOf(name) === at)

if (!existsSync('dist/index.html')) {
  console.error('No build to publish. Run `npm run build` first.')
  process.exit(1)
}

/*
 * Only a build that could read the database knows the full set of item
 * cards. One that could not must add to what is published rather than
 * replace it, or it would delete every card under create/ on its way past.
 */
const authoritative = existsSync('dist/.item-pages')

const copied = []

for (const name of built) {
  /*
   * Item pages are written from the database, so a build that could not
   * reach it has none. Leaving the published ones alone is right: a run
   * without the database should not wipe every card off the site.
   */
  if (!existsSync(`dist/${name}`)) continue

  // Asset filenames are content hashed, so stale ones have to go rather than
  // pile up in the repository.
  if (authoritative || !itemBearing.includes(name)) {
    rmSync(name, { recursive: true, force: true })
  }
  cpSync(`dist/${name}`, name, { recursive: true })
  copied.push(name)
}

/*
 * The pages that were left alone still have to point at this build.
 *
 * This is the bug Staw kept hitting and it was never a loading bug: "when
 * you reload a profile page or a community page or worlds, then it says
 * this and doesn't load and it keeps doing that". Every page under u/, c/
 * and worlds/ is a real file, written by whichever build last reached the
 * database, and it names that build's pieces by their content hash. A
 * build that cannot reach the database leaves those files alone - rightly,
 * it has nothing to write - but it still replaces assets/, so the pieces
 * those files name are deleted. The document then fetches a module that
 * 404s, nothing runs, and the mark in the markup sits there for ever. The
 * page is not slow, it is pointing at a build that no longer exists.
 *
 * Reloading cannot fix that, which is why the "Load it again" button under
 * the mark never did. So every published page is brought up to this
 * build's pieces here, whether or not it was rewritten: the head block has
 * the same shape in all of them because they all come out of the same
 * template.
 */
const assetBlock = /<script type="module"[^>]*><\/script>(?:\s*<link rel="modulepreload"[^>]*>)*\s*<link rel="stylesheet"[^>]*>/

/*
 * The boot script goes over too, for the same reason: it is the part that
 * rescues a page which cannot load itself, and a page written before it
 * existed does not have it. There is exactly one script with no attributes
 * in the template, which is that one.
 */
const bootScript = /<script>[\s\S]*?<\/script>/

const fresh = readFileSync('dist/404.html', 'utf8')
const current = fresh.match(assetBlock)?.[0]
const currentBoot = fresh.match(bootScript)?.[0]

let freshened = 0

if (!current) {
  console.warn('Could not find the asset block in dist/404.html; pages left as they are.')
} else {
  for (const root of itemBearing) {
    if (!existsSync(root)) continue
    for (const file of readdirSync(root, { recursive: true, withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith('.html')) continue
      const path = `${file.parentPath ?? file.path}/${file.name}`
      const page = readFileSync(path, 'utf8')
      const had = page.match(assetBlock)?.[0]
      const hadBoot = page.match(bootScript)?.[0]
      if ((!had || had === current) && (!currentBoot || hadBoot === currentBoot)) continue
      let next = had ? page.replace(assetBlock, () => current) : page
      if (currentBoot && hadBoot && hadBoot !== currentBoot) {
        next = next.replace(bootScript, () => currentBoot)
      }
      writeFileSync(path, next)
      freshened += 1
    }
  }
}

console.log(`Published to the repository root: ${copied.join(', ')}`)
console.log(`Pointed ${freshened} already-published pages at this build.`)
