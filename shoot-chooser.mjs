import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 1700 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5343/tools/site/appearance-preview.html', { waitUntil: 'networkidle' })
await p.locator('[role="dialog"] button').first().click().catch(() => {})
await p.waitForTimeout(500)
for (const look of ['default', 'halloween', 'christmas']) {
  for (const mode of ['dark', 'light']) {
    await p.evaluate(([l, m]) => {
      document.documentElement.dataset.appearance = l
      document.documentElement.dataset.theme = m
    }, [look, mode])
    await p.waitForTimeout(250)
    const shown = await p.evaluate(() =>
      [...document.querySelectorAll('[data-appearance] .kob-mark')]
        .filter((n) => n.getBoundingClientRect().width > 0)
        .map((n) => `${n.closest('[data-appearance]').dataset.appearance}:${n.getAttribute('src').split('/').pop()}`))
    console.log('worn', look, mode, '->', [...new Set(shown)].join('  '), '| count', shown.length)
  }
}
await b.close()
