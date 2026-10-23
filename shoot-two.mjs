import { chromium } from 'playwright'
const width = Number(process.argv[2] ?? 1920)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const n of process.argv.slice(3)) {
  const p = await b.newPage({ viewport: { width, height: 950 } })
  await p.goto(`http://localhost:5347/tools/site/phone-preview.html?page=${n}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(600)
  await p.screenshot({ path: `/tmp/g${width}-${n}.png` })
  await p.close()
}
await b.close()
