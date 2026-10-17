import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1200, height: 400 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5343/tools/site/wordmark-preview.html', { waitUntil: 'networkidle' })
for (const width of [360, 639, 640, 641, 1200]) {
  await p.setViewportSize({ width, height: 400 })
  for (const mode of ['dark', 'light']) {
    await p.evaluate((m) => { document.documentElement.dataset.theme = m }, mode)
    await p.waitForTimeout(250)
    const counts = await p.evaluate(() =>
      [...document.querySelectorAll('.kob-mark')]
        .filter((n) => n.getBoundingClientRect().width > 0)
        .reduce((all, n) => {
          const box = n.closest('[data-appearance]').dataset.appearance
          all[box] = (all[box] || 0) + 1
          return all
        }, {}))
    console.log(width, mode, JSON.stringify(counts))
  }
}
await p.screenshot({ path: '/tmp/wordmark-narrow.png' })
await b.close()
