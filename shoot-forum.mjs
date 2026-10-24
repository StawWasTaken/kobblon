/* The forum's new pieces, on the bare page that mounts them. */
import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1480, height: 1000 }, deviceScaleFactor: 2 })

const bad = []
p.on('pageerror', (e) => bad.push('threw: ' + e.message))

await p.goto('http://localhost:5343/tools/site/forum-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1000)
await p.screenshot({ path: '/tmp/forum-pieces.png', fullPage: true })

const shot = async (n, name) =>
  p.locator('section').nth(n).screenshot({ path: `/tmp/forum-${name}.png` })
await shot(0, 'bylines')
await shot(1, 'marks')
await shot(5, 'rail')

/* The three dots, open, which is the half of that component worth seeing. */
await p.locator('section').nth(2).locator('button').first().click()
await p.waitForTimeout(300)
await p.screenshot({ path: '/tmp/forum-menu.png' })

console.log(bad.length ? bad.join(' | ') : 'nothing threw')
await b.close()
