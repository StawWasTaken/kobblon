import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 1280, height: 760 } })
await p.goto('http://localhost:5344/', { waitUntil: 'networkidle' })
await p.waitForTimeout(3000)
await p.screenshot({ path: '/tmp/shot-landing.png' })
await b.close()
