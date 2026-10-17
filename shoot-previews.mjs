import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const mode of ['dark', 'light']) {
  const p = await b.newPage({ viewport: { width: 900, height: 400 } })
  p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
  await p.goto('http://localhost:5343/tools/site/appearance-preview.html', { waitUntil: 'networkidle' })
  await p.locator('[role="dialog"] button').first().click().catch(() => {})
  await p.waitForTimeout(400)
  if (mode === 'light') await p.locator('button', { hasText: 'Light' }).first().click()
  await p.waitForTimeout(800)
  await p.screenshot({ path: `/tmp/previews-${mode}.png`, clip: { x: 20, y: 80, width: 860, height: 150 } })
  await p.close()
}
await b.close()
