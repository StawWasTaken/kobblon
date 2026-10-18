import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 800, height: 500 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 160)))
await p.goto('http://localhost:5343/tools/site/loading-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
console.log(await p.evaluate(() => {
  const n = document.querySelector('[role="status"]')
  if (!n) return 'no loading screen'
  const s = getComputedStyle(n)
  return `${s.position} z:${s.zIndex} bg:${s.backgroundColor} ${n.getBoundingClientRect().width}x${n.getBoundingClientRect().height}`
}))
await p.screenshot({ path: '/tmp/loading.png' })
await b.close()
