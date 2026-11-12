const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  const c = await b.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 })
  const page = await c.newPage()
  await page.route('**/*', r => r.request().url().includes('supabase') ? r.fulfill({ status: 200, body: '[]' }) : r.continue())
  for (const [path, name] of [['/', 'landing'], ['/login','login'], ['/download','download'], ['/about','about'], ['/support','support']]) {
    await page.goto('http://localhost:5398' + path, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `/tmp/claude-0/p-${name}.png`, fullPage: false })
  }
  await b.close()
})()
