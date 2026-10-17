import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, width] of [['wide', 900], ['narrow', 420]]) {
  const p = await b.newPage({ viewport: { width, height: 1000 } })
  p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
  await p.goto('http://localhost:5343/tools/site/appearance-preview.html', { waitUntil: 'networkidle' })
  await p.locator('[role="dialog"] button').first().click().catch(() => {})
  await p.waitForTimeout(900)
  await p.screenshot({ path: `/tmp/marks-${name}.png`, clip: { x: 0, y: 70, width, height: 480 } })
  await p.close()
}
await b.close()
