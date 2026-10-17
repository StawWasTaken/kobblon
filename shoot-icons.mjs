import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 420 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 200)))
await p.goto('http://localhost:5343/tools/site/icons-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)
console.log(await p.evaluate(() =>
  [...document.querySelectorAll('[style*="mask-image"]')].map((n) => {
    const r = n.getBoundingClientRect()
    return `${Math.round(r.width)}x${Math.round(r.height)}`
  }).join(' ')))
await p.screenshot({ path: '/tmp/icons.png' })
await b.close()
