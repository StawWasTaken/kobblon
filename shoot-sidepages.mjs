import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 1100 }, deviceScaleFactor: 1 })
const bad = []
p.on('pageerror', (e) => bad.push('threw: ' + e.message))
await p.goto('http://localhost:5343/tools/site/sidepages-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.screenshot({ path: '/tmp/side-top.png' })
await p.evaluate(() => window.scrollTo(0, 1100))
await p.waitForTimeout(400)
await p.screenshot({ path: '/tmp/side-mid.png' })
console.log('navs:', await p.locator('nav').count(), 'footers:', await p.locator('footer').count())
console.log(bad.length ? bad.join(' | ') : 'nothing threw')
await b.close()
