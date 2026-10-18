import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
await p.goto('http://localhost:5343/tools/site/wordmark-preview.html', { waitUntil: 'networkidle' })
// strip the wrappers so the marks sit directly under the document, like the topbar
await p.evaluate(() => {
  document.querySelectorAll('[data-appearance]').forEach((n) => {
    if (n !== document.documentElement) n.removeAttribute('data-appearance')
  })
})
for (const look of ['default', 'halloween', 'christmas']) {
  for (const mode of ['dark', 'light']) {
    await p.evaluate(([l, m]) => {
      document.documentElement.dataset.appearance = l
      document.documentElement.dataset.theme = m
    }, [look, mode])
    await p.waitForTimeout(200)
    const shown = await p.evaluate(() =>
      [...document.querySelectorAll('.kob-mark')]
        .filter((n) => n.getBoundingClientRect().width > 0)
        .map((n) => n.getAttribute('src').split('/').pop()))
    console.log(look, mode, shown.length, [...new Set(shown)].join(' '))
  }
}
await b.close()
