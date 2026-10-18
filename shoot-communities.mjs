import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
await p.goto('http://localhost:5343/tools/site/communities-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(900)
await p.screenshot({ path: '/tmp/communities.png', fullPage: true })
const buttons = await p.evaluate(() => {
  const out = {}
  document.querySelectorAll('section').forEach((s) => {
    const rank = s.querySelector('p').textContent
    out[rank] = [...s.querySelectorAll('button, a')].map((e) => e.textContent.trim()).filter(Boolean)
  })
  return out
})
console.log(JSON.stringify(buttons, null, 1))
await b.close()
