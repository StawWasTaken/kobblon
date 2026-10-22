import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5343'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 560 } })
await p.goto(base + '/tools/site/peek-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)

const faces = p.locator('.grid > div')
await faces.nth(0).hover()
await p.waitForTimeout(300)
console.log('one up:', await p.locator('text=Message').count())

await faces.nth(1).hover()
await p.waitForTimeout(60)
console.log('mid move, cards up:', await p.locator('text=Message').count())
await p.waitForTimeout(260)
console.log('after move, cards up:', await p.locator('text=Message').count())
await p.screenshot({ path: '/tmp/shot-peek.png' })
await b.close()
