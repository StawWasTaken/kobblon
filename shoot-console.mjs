import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 300)))

await p.goto('http://localhost:5343/tools/site/console-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(2000)

for (const panel of ['Overview', 'People', 'Notice', 'Record']) {
  const hit = p.locator('nav button').filter({ hasText: panel }).first()
  if (await hit.count()) {
    await hit.click()
    await p.waitForTimeout(900)
  }
  if (panel === 'People') {
    const filters = p.locator('button').filter({ hasText: /^Filters/ }).first()
    if (await filters.count()) { await filters.click(); await p.waitForTimeout(500) }
  }
  await p.screenshot({ path: `/tmp/console-${panel}.png`, fullPage: panel !== 'Overview' })
}
await b.close()
