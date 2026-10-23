import { chromium } from 'playwright'
const width = Number(process.argv[2] ?? 1440)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const n of ['home','discover']) {
  const p = await b.newPage({ viewport: { width, height: 950 } })
  const shouts = []
  p.on('pageerror', (e) => shouts.push('THREW ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') shouts.push('CONSOLE ' + m.text().slice(0, 140)) })
  await p.goto(`http://localhost:5347/tools/site/phone-preview.html?page=${n}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
  const d = await p.evaluate(() => ({ spill: document.documentElement.scrollWidth - document.documentElement.clientWidth, tall: document.documentElement.scrollHeight }))
  console.log(n, width, JSON.stringify(d), shouts.slice(0,3).join(' | '))
  await p.screenshot({ path: `/tmp/t${width}-${n}.png`, fullPage: width < 500 })
  await p.close()
}
await b.close()
