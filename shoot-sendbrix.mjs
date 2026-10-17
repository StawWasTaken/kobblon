import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 900 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 300)))

await p.goto('http://localhost:5343/tools/site/sendbrix-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

const box = p.locator('input[type="number"], input').first()
await box.fill('500')
await p.waitForTimeout(500)
await p.screenshot({ path: '/tmp/sendbrix.png' })
await b.close()
