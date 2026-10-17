import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 300 } })
await p.goto('http://localhost:5343/tools/site/icons-preview.html', { waitUntil: 'networkidle' })
for (const mode of ['dark', 'light']) {
  for (const look of ['default', 'halloween', 'christmas']) {
    await p.evaluate(([m, l]) => {
      document.documentElement.dataset.theme = m
      document.documentElement.dataset.appearance = l
    }, [mode, look])
    await p.waitForTimeout(200)
    console.log(mode, look, await p.evaluate(() => getComputedStyle(document.querySelector('.bg-chrome')).backgroundColor))
  }
}
await p.screenshot({ path: '/tmp/chrome.png' })
await b.close()
