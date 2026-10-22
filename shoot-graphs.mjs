import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5343'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1100, height: 1000 } })
await p.goto(base + '/tools/site/graph-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
await p.mouse.move(600, 180)
await p.waitForTimeout(250)
await p.screenshot({ path: '/tmp/shot-graphs.png', fullPage: true })
await b.close()
