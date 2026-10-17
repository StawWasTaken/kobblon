import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 700, height: 300 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5343/tools/site/wordmark-preview.html', { waitUntil: 'networkidle' })
for (const mode of ['dark', 'light']) {
  await p.evaluate((m) => { document.documentElement.dataset.theme = m }, mode)
  await p.waitForTimeout(500)
  console.log(mode, await p.evaluate(() =>
    [...document.querySelectorAll('.kob-mark')]
      .filter((n) => getComputedStyle(n).display !== 'none')
      .map((n) => n.getAttribute('src').split('/').pop())
      .join(' ')))
  await p.screenshot({ path: `/tmp/wordmark-${mode}.png` })
}
await b.close()
