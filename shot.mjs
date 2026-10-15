import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
await p.goto('http://localhost:5333/tools/site/avatar-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
await p.screenshot({ path: 'avatar.png', fullPage: true })
await b.close()
