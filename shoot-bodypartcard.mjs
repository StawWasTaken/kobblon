import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 700, height: 460 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 300)))
await p.goto('http://localhost:5343/tools/site/bodypartcard-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(9000)
await p.screenshot({ path: '/tmp/shot-bodypartcard.png' })
await b.close()
