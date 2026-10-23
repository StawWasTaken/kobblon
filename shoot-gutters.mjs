import { chromium } from 'playwright'
const pages = ['home','discover','people','communities','catalog','avatar','settings',
  'friends','library','quests','brix','inbox','standing','support','staff']
const width = Number(process.argv[2] ?? 1920)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const n of pages) {
  const p = await b.newPage({ viewport: { width, height: 950 } })
  await p.goto(`http://localhost:5347/tools/site/phone-preview.html?page=${n}`, { waitUntil: 'networkidle' })
  await p.waitForTimeout(500)
  const m = await p.evaluate(() => {
    const main = document.querySelector('main')
    const mr = main.getBoundingClientRect()
    const pad = parseFloat(getComputedStyle(main).paddingLeft) || 0
    const kids = [...main.children].filter((e) => e.getBoundingClientRect().width > 0)
    return kids.map((e) => {
      const r = e.getBoundingClientRect()
      return { left: Math.round(r.left - mr.left - pad), right: Math.round(mr.right - r.right), w: Math.round(r.width) }
    })
  })
  const bad = m.filter((x) => Math.abs(x.left - x.right) > 2)
  console.log(n.padEnd(12), JSON.stringify(m), bad.length ? '  <-- OFF' : '')
  await p.close()
}
await b.close()
