import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage({ viewport: { width: 900, height: 820 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 300)))
for (const card of ['buy', 'basket', 'stars']) {
  await p.goto(`http://localhost:5343/tools/site/cards-preview.html?card=${card}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `/tmp/shot-${card}.png` })
}
await b.close()
