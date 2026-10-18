import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, w] of [['wide', 1400], ['narrow', 700]]) {
  const p = await b.newPage({ viewport: { width: w, height: 300 } })
  await p.goto('http://localhost:5343/tools/site/event-bar-preview.html', { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  await p.screenshot({ path: `/tmp/eventbar-${name}.png` })
  await p.close()
}
await b.close()
console.log('shot')
