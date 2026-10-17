import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 950 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5399/', { waitUntil: 'networkidle' })
await p.waitForTimeout(5000)
await p.screenshot({ path: '/tmp/home.png' })
await b.close()
