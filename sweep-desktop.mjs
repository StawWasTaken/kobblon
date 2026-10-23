import { chromium } from 'playwright'
const pages = ['home','discover','people','communities','catalog','avatar','settings',
  'friends','library','quests','brix','inbox','standing','support','staff']
const width = Number(process.argv[2] ?? 1440)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const n of pages) {
  const p = await b.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: 1 })
  const shouts = []
  p.on('pageerror', (e) => shouts.push('THREW ' + e.message))
  p.on('console', (m) => { if (m.type() === 'error') shouts.push('CONSOLE ' + m.text().slice(0, 120)) })
  await p.goto(`http://localhost:5347/tools/site/phone-preview.html?page=${n}`, { waitUntil: 'networkidle' })
  const info = await p.evaluate(() => {
    const d = document.documentElement
    // anything whose text is clipped by its own box
    const clipped = []
    document.querySelectorAll('main *').forEach((e) => {
      if (e.children.length) return
      if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
        const s = getComputedStyle(e)
        if (s.textOverflow !== 'ellipsis' && s.overflow === 'visible') return
        clipped.push((e.textContent || '').trim().slice(0, 40))
      }
    })
    return {
      spill: d.scrollWidth - d.clientWidth,
      tall: d.scrollHeight,
      clipped: clipped.slice(0, 4),
    }
  })
  console.log(n.padEnd(12), 'spill', String(info.spill).padStart(5), String(info.tall).padStart(6) + 'px',
    shouts.length ? '| ' + shouts.slice(0,2).join(' ') : '')
  await p.screenshot({ path: `/tmp/w${width}-${n}.png`, fullPage: true })
  await p.close()
}
await b.close()
