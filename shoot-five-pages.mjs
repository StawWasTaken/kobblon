/* The five redesigned pages, shot one at a time against the preview server.
 *
 * `npx vite --config vite.pages.config.mjs` first, which serves them from
 * source with a fixture client and a signed-in fixture. Console errors are
 * printed: a panel that throws goes blank, and a blank panel in a screenshot
 * is the one failure that reads as "looks fine".
 */
import { chromium } from 'playwright'

const pages = ['catalog', 'communities', 'discover', 'people', 'settings']
const width = Number(process.argv[2] ?? 1440)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const name of pages) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } })
  const shouts = []
  page.on('console', (one) => { if (one.type() === 'error') shouts.push(one.text()) })
  page.on('pageerror', (one) => shouts.push(`THREW ${one.message}`))

  await page.goto(`http://localhost:5347/tools/site/pages-preview.html?page=${name}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(1200)

  const out = `/tmp/five-${name}-${width}.png`
  await page.screenshot({ path: out, fullPage: true })

  const tall = await page.evaluate(() => document.body.scrollHeight)
  const empty = await page.evaluate(() => (document.body.innerText.trim().length < 40))
  console.log(`${name.padEnd(12)} ${out}  ${tall}px${empty ? '  EMPTY' : ''}`)
  for (const shout of shouts.slice(0, 6)) console.log(`   ! ${shout.slice(0, 220)}`)
  await page.close()
}

await browser.close()
