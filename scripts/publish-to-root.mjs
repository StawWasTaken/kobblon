// Copies the build into the repository root, which is what GitHub Pages
// publishes when its source is a branch. Run by the deploy workflow after
// `npm run build`; `npm run deploy` does both by hand.
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs'
import { pageRoots } from './site-pages.mjs'

// The addresses that point at something get their own files too, written
// by write-item-pages.mjs before this runs.
const itemRoots = ['s', 'c', 'u', 'e', 'style']

/** Roots that hold item cards as well as pages written from site-pages.mjs. */
const itemBearing = [...itemRoots, 'create']

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

console.log(`Published to the repository root: ${copied.join(', ')}`)
