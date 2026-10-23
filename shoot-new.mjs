import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const shots = [
  ['maintenance', 'http://localhost:5347/tools/site/maintenance-preview.html', 1280, 900],
  ['shutters', 'http://localhost:5347/tools/site/phone-preview.html?page=staff&panel=shutters', 1440, 950],
  ['phonebar', 'http://localhost:5347/tools/site/phone-preview.html?page=home', 390, 420],
]
for (const [name, url, w, h] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  p.on('pageerror', e => console.log(name, 'THREW', e.message))
  await p.goto(url, { waitUntil: 'networkidle' })
  await p.waitForTimeout(800)
  await p.screenshot({ path: `/tmp/n-${name}.png` })
  await p.close()
}
await b.close()
console.log('shot')
