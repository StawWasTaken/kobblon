/* The forum's new pieces, on the bare page that mounts them. */
import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1480, height: 1000 }, deviceScaleFactor: 2 })

const bad = []
p.on('pageerror', (e) => bad.push('threw: ' + e.message))

await p.goto('http://localhost:5343/tools/site/forum-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

const names = await p.locator('section > p').allTextContents()
console.log(names.map((n, i) => `${i}: ${n}`).join('\n'))

const shot = async (n, name) =>
  p.locator('section').nth(n).screenshot({ path: `/tmp/forum-${name}.png` })

const at = (label) => names.findIndex((n) => n.includes(label))
await shot(at('status pairs'), 'status')
await shot(at('clip and a picture'), 'attachments')
await shot(at('foot of the page'), 'footer')

/* The viewer, open over the clip. */
await p.locator('section').nth(at('clip and a picture')).locator('button').nth(1).click()
await p.waitForTimeout(600)
await p.screenshot({ path: '/tmp/forum-lightbox.png' })

console.log(bad.length ? bad.join(' | ') : 'nothing threw')
await b.close()
