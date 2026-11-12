const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })
  const page = await c.newPage()
  await page.route('**/*', r => r.request().url().includes('supabase')
    ? r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }) : r.continue())
  await page.goto('http://localhost:5398/style', { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  for (const [id, name] of [['mark','mark'],['pieces','pieces']]) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded()
    await page.waitForTimeout(300)
    await page.locator(`#${id}`).screenshot({ path: `/tmp/claude-0/crop-${name}.png` })
  }
  await b.close()
})()
