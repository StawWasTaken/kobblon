import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5343'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1100, height: 1400 } })
const bad = []
p.on('pageerror', (e) => bad.push(String(e)))
await p.goto(base + '/tools/site/economy-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
await p.screenshot({ path: '/tmp/shot-economy.png', fullPage: true })
console.log('errors:', bad.length ? bad : 'none')
console.log((await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 900))
await b.close()
