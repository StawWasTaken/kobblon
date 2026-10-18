import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
await p.goto('http://localhost:5343/tools/site/wordmark-preview.html', { waitUntil: 'networkidle' })
for (const look of ['default', 'halloween', 'christmas']) {
  for (const mode of ['dark', 'light']) {
    await p.evaluate(([l, m]) => {
      document.documentElement.dataset.appearance = l
      document.documentElement.dataset.theme = m
    }, [look, mode])
    await p.waitForTimeout(200)
    console.log(look, mode, await p.evaluate(() =>
      [...document.querySelectorAll('[data-appearance]')]
        .filter((n) => n !== document.documentElement)
        .map((n) => `${n.dataset.appearance}=${getComputedStyle(n).getPropertyValue('--chrome').trim()}`)
        .join('  ')))
  }
}
await b.close()
