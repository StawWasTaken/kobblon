import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5343'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1180, height: 700 } })
await p.goto(base + '/tools/site/friends-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.screenshot({ path: '/tmp/shot-friends.png', fullPage: true })
console.log((await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 600))
await b.close()
