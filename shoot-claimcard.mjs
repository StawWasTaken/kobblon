import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 800 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5343/tools/site/appearance-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(2500)
const art = await p.evaluate(() => {
  const img = document.querySelector('[role="dialog"] img')
  return img ? img.getAttribute('src') : 'no card'
})
console.log('card art:', art)
await p.screenshot({ path: '/tmp/claim-card.png' })
await b.close()
