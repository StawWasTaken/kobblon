import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1000, height: 760 } })
await p.goto('http://localhost:5333/tools/site/broke-preview.html', { waitUntil: 'networkidle' })
await p.screenshot({ path: '/tmp/broke.png' })
await b.close()
