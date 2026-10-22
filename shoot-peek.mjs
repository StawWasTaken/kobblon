import { chromium } from 'playwright'

const base = process.argv[2] || 'http://localhost:5343'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 700, height: 520 } })
await p.goto(base + '/tools/site/peek-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await p.locator('img, span').first().hover()
await p.waitForTimeout(400)
await p.screenshot({ path: '/tmp/shot-peek.png' })
console.log((await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 500))
await b.close()
