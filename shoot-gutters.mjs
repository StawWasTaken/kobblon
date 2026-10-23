import { chromium } from 'playwright'
const width = Number(process.argv[2] ?? 1920)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const n of ['home','discover','catalog','people','settings']) {
  const p = await b.newPage({ viewport: { width, height: 950 } })
  await p.goto(`http://localhost:5347/tools/site/phone-preview.html?page=${n}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(700)
  const m = await p.evaluate(() => {
    const main = document.querySelector('main')
    const page = main?.firstElementChild
    const r = page?.getBoundingClientRect()
    const mr = main?.getBoundingClientRect()
    return r && mr ? { left: Math.round(r.left - mr.left), right: Math.round(mr.right - r.right) } : null
  })
  console.log(n.padEnd(11), JSON.stringify(m))
  await p.screenshot({ path: `/tmp/g${width}-${n}.png` })
  await p.close()
}
await b.close()
