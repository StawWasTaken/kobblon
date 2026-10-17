import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1400, height: 950 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5399/', { waitUntil: 'networkidle' })
await p.waitForTimeout(5000)
for (const mode of ['dark', 'light']) {
  for (const look of ['default', 'halloween', 'christmas']) {
    await p.evaluate(([m, l]) => {
      document.documentElement.dataset.theme = m
      document.documentElement.dataset.appearance = l
    }, [mode, look])
    await p.waitForTimeout(400)
    const seen = await p.evaluate(() => {
      const bar = document.querySelector('header, .bg-chrome')
      return {
        chrome: getComputedStyle(document.documentElement).getPropertyValue('--chrome').trim(),
        bar: bar ? getComputedStyle(bar).backgroundColor : 'none',
        icons: [...document.querySelectorAll('[style*="mask-image"]')]
          .map((n) => Math.round(n.getBoundingClientRect().height))
          .slice(0, 12)
          .join(','),
      }
    })
    console.log(mode, look, JSON.stringify(seen))
    await p.screenshot({ path: `/tmp/season-${mode}-${look}.png` })
  }
}
await b.close()
