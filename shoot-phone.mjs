/* Every page this harness can reach, at phone width, measured and shot.
 *
 * Two numbers matter and neither is a matter of taste: how far the page
 * scrolls sideways, which should be zero, and anything that sticks out past
 * the viewport, which names the element to fix. Everything else is looked at.
 */
import { chromium } from 'playwright'

const names = process.argv.slice(3).length
  ? process.argv.slice(3)
  : ['home', 'discover', 'people', 'communities', 'catalog', 'avatar',
     'settings', 'friends', 'library', 'quests', 'brix', 'inbox',
     'standing', 'support', 'staff']
const width = Number(process.argv[2] ?? 390)

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const name of names) {
  const page = await browser.newPage({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const shouts = []
  page.on('pageerror', (one) => shouts.push(`THREW ${one.message}`))

  await page.goto(`http://localhost:5347/tools/site/phone-preview.html?page=${name}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForTimeout(1100)

  const over = await page.evaluate(() => {
    const root = document.documentElement
    const spill = root.scrollWidth - root.clientWidth
    if (spill <= 0) return { spill: 0, blamed: [] }
    // Which elements actually reach past the right edge, innermost first.
    const blamed = []
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect()
      if (box.right <= root.clientWidth + 1 || box.width === 0) continue
      if (el.querySelector('*') && [...el.children].some((kid) =>
        kid.getBoundingClientRect().right > root.clientWidth + 1)) continue
      blamed.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ').slice(0, 4).join('.')} → ${Math.round(box.right)}px`)
    }
    return { spill, blamed: blamed.slice(0, 5) }
  })

  const out = `/tmp/phone-${name}.png`
  await page.screenshot({ path: out, fullPage: true })
  const tall = await page.evaluate(() => document.body.scrollHeight)

  console.log(`${name.padEnd(12)} spill ${String(over.spill).padStart(4)}px   ${tall}px tall`)
  for (const blame of over.blamed) console.log(`     ↳ ${blame}`)
  for (const shout of shouts.slice(0, 3)) console.log(`     ! ${shout.slice(0, 200)}`)
  await page.close()
}

await browser.close()
