const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] })
  for (const theme of ['dark','light']) {
    const c = await b.newContext({ viewport: { width: 1280, height: 1400 }, deviceScaleFactor: 1 })
    const page = await c.newPage()
    await page.route('**/*', r => r.request().url().includes('supabase')
      ? r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }) : r.continue())
    await page.addInitScript(t => { try { localStorage.setItem('kob.theme', t) } catch {} ; document.documentElement.setAttribute('data-theme', t) }, theme)
    await page.goto('http://localhost:5398/style', { waitUntil: 'networkidle' })
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
    await page.waitForTimeout(900)
    await page.screenshot({ path: `/tmp/claude-0/style-${theme}.png`, fullPage: true })
  }
  await b.close()
})()
