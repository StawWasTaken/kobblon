/*
 * Look at the built site, at two widths, without a database.
 *
 * CLAUDE.md asks for a screenshot of every UI change, and for it to be taken
 * of a build rather than of `vite dev` on `/` - `publish-to-root.mjs` leaves
 * an index.html at the repository root pointing at the last deployed bundle,
 * and the dev server hands the browser that instead of the working tree.
 * That has cost an hour once already. So this serves `dist/` and nothing
 * else.
 *
 * It had been rewritten from memory three rounds running, each time with the
 * same two traps rediscovered the hard way, so it lives here now with both
 * written down:
 *
 *   1. **The last matching route wins in Playwright.** A catch-all
 *      `**!/rest/v1/**` registered after `**!/rest/v1/profiles*` swallows it,
 *      and the page renders signed out while every stub looks correct. The
 *      specific routes below are therefore registered last, on purpose.
 *   2. **The boot splash covers everything for REVEAL_MS.** A screenshot
 *      taken before it lifts is a logomark on black. Hence the wait.
 *
 * Usage:  node tools/shots/shoot.mjs [out-dir] [name=/route ...]
 * With no routes it takes the set below.
 */
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { chromium } from 'playwright'

const ROOT = resolve('dist')
const PORT = 5399
const PROJECT = 'sdnjdgeqrhzkyfyohcsz'

/** How long the boot splash holds the page, plus room for a slow paint. */
const BOOT_MS = 7000

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.json': 'application/json', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.ico': 'image/x-icon',
}

/* Every route the site has is served by one index.html, so anything that is
   not a file on disk is the app. */
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(req.url.split('?')[0])
  const onDisk = join(ROOT, path)
  const file = existsSync(onDisk) && extname(onDisk) ? onDisk : join(ROOT, 'index.html')
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404).end('no')
  }
})

/** A signed-in session, as supabase-js stores one. */
const session = {
  access_token: 'stub', token_type: 'bearer', expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'stub',
  user: {
    id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated',
    role: 'authenticated', email: 'staw@kobblon.com',
    app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString(),
  },
}

const me = {
  id: session.user.id, username: 'stawrer', display_name: 'Staw',
  avatar_url: null, bio: null, pixels: 5400, is_guest: false, is_staff: true,
  created_at: '2026-01-11T00:00:00Z', birthday: '2008-04-11',
  colour: null, appearance: null, status: 'online',
}

/* An array for a `.select()`, an object for a `.maybeSingle()`. Getting this
   the wrong way round is why the profile read came back empty once - and,
   the other way round, why People threw `find is not a function` for a
   while: a list query handed one object. PostgREST decides by the Accept
   header, and so does the stub below. */
const RPC = {
  my_behaviour: [{ score: 72, band: 'mixed' }],
  my_standing: [{ level: 'clear' }],
  my_moderation_history: [],
  my_worlds: [], my_tickets: [], world_genres: [],
}

async function shoot(routes, outDir) {
  await mkdir(outDir, { recursive: true })
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const trouble = []

  for (const [name, route] of routes) {
    for (const [tag, width, height] of [['desktop', 1440, 1100], ['phone', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } })
      page.on('pageerror', (e) => trouble.push(`${name} ${tag}: ${e.message}`))
      page.on('console', (m) => {
        /* Realtime cannot be stubbed and the agent proxy refuses the
           tunnel, so every page reports a websocket it was never going to
           get here. That is the harness, not the site. */
        const noise = /favicon|404 \(Not Found\)|realtime|ERR_TUNNEL/i
        if (m.type() === 'error' && !noise.test(m.text())) {
          trouble.push(`${name} ${tag}: ${m.text()}`)
        }
      })

      /* A route written `~/path` is shot signed out: the landing page
         redirects a session straight to /home, so without this the public
         front of the site can never be looked at. */
      const guest = route.startsWith('~')
      const where = guest ? route.slice(1) : route

      if (!guest) {
        await page.addInitScript(([key, value]) => {
          window.localStorage.setItem(key, value)
        }, [`sb-${PROJECT}-auth-token`, JSON.stringify(session)])
      }

      await page.route(`**/${PROJECT}.supabase.co/auth/v1/**`, (r) =>
        r.fulfill({ json: { ...session, ...session.user } }))
      await page.route('**/rest/v1/**', (r) => r.fulfill({ json: [] }))
      /* Last wins. These must stay below the catch-all. */
      await page.route('**/rest/v1/profiles*', (r) => {
        const wantsOne = (r.request().headers().accept ?? '').includes('pgrst.object')
        return r.fulfill({ json: wantsOne ? me : [me] })
      })
      await page.route('**/rest/v1/rpc/*', (r) => {
        const fn = r.request().url().split('/rpc/')[1].split('?')[0]
        return r.fulfill({ json: RPC[fn] ?? [] })
      })

      await page.goto(`http://localhost:${PORT}${where}`, { waitUntil: 'domcontentloaded' })
      await page.waitForTimeout(BOOT_MS)

      /* The daily claim card opens over whatever page you land on, so every
         screenshot was of the same popup until this went in. */
      const notNow = page.getByRole('button', { name: 'Not now' })
      if (await notNow.count()) {
        await notNow.first().click()
        await page.waitForTimeout(500)
      }
      await page.screenshot({ path: join(outDir, `${name}-${tag}.png`), fullPage: false })
      await page.close()
    }
  }

  await browser.close()
  return trouble
}

const DEFAULT = [
  ['home', '/home'], ['discover', '/discover'], ['catalog', '/catalog'],
  ['people', '/people'], ['communities', '/communities'], ['library', '/library'],
  ['settings', '/settings'], ['standing', '/standing'], ['support', '/support'],
  ['avatar', '/avatar'], ['create', '/create'],
  ['landing', '~/'], ['login', '~/login'], ['download', '~/download'],
]

const args = process.argv.slice(2)
const outDir = args[0] && !args[0].includes('=') ? args[0] : 'shots'
const picked = args.filter((a) => a.includes('='))
  .map((a) => [a.split('=')[0], a.slice(a.indexOf('=') + 1)])

await new Promise((go) => server.listen(PORT, go))
const trouble = await shoot(picked.length ? picked : DEFAULT, outDir)
server.close()

console.log(trouble.length ? trouble.join('\n') : 'nothing threw')
