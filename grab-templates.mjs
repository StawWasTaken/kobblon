/*
 * Writes public/templates/*.png from the code that draws them.
 *
 * The sheets are never edited by hand: they describe the regions the
 * wrapping reads, so a hand-edited one is a template that lies. Run the site
 * dev server on 5333, run this, commit what it writes.
 *
 * It also checks the thing that matters most about the sheet - that nothing
 * it draws sits inside a panel, because a panel is the garment.
 */
import { chromium } from 'playwright'
import { writeFileSync } from 'node:fs'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage()
await page.goto('http://localhost:5333/tools/site/template-sheets.html', { waitUntil: 'networkidle' })
for (const kind of ['shirt', 'trousers']) {
  const url = await page.getAttribute(`#save-${kind}`, 'href')
  writeFileSync(`public/templates/kobblon-${kind}-template.png`, Buffer.from(url.split(',')[1], 'base64'))
}

// Nothing the sheet draws may sit inside a panel: it would be painted onto
// the garment by anybody who did not cover every corner of it.
const dirty = await page.evaluate(async () => {
  const { templateFor, drawTemplate } = await import('/src/engine/clothes.ts')
  const bad = []
  for (const kind of ['shirt', 'trousers']) {
    const sheet = templateFor(kind)
    const canvas = drawTemplate(sheet, document.createElement('canvas'))
    const brush = canvas.getContext('2d')
    for (const [name, r] of Object.entries(sheet.regions)) {
      const data = brush.getImageData(r.x, r.y, r.w, r.h).data
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) { bad.push(`${kind} ${name}`); break }
      }
    }
  }
  return bad
})
console.log(dirty.length ? `INSIDE A PANEL: ${dirty.join(', ')}` : 'every panel is clear')
await browser.close()
