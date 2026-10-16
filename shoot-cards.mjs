import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1200, height: 640 } })
p.on('console', (m) => console.log('[page]', m.text()))
await p.goto('http://localhost:5341/tools/site/card-draw.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(9000)
await p.screenshot({ path: '/tmp/shot-cards.png' })
await b.close()
