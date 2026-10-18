import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 700 } })
await p.goto('http://localhost:5343/tools/site/reactions-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.screenshot({ path: '/tmp/react-closed.png' })

// Open the tray on the row that already has reactions.
await p.locator('button[aria-label="React"]').first().click()
await p.mouse.move(850, 600)
await p.waitForTimeout(600)
await p.screenshot({ path: '/tmp/react-open.png' })

// Measure: does the pointer sit over the button?
const m = await p.evaluate(() => {
  const btn = document.querySelector('button[aria-label="React"]').getBoundingClientRect()
  const tray = document.querySelector('[role="menu"]').getBoundingClientRect()
  const caret = [...document.querySelectorAll('span[aria-hidden]')]
    .map((s) => s.getBoundingClientRect())
    .filter((r) => r.width > 10 && r.width < 20 && r.height > 10 && r.height < 20)
  const chip = document.querySelector('button[aria-pressed]').getBoundingClientRect()
  const icon = document.querySelector('button[aria-pressed] img, button[aria-pressed] span').getBoundingClientRect()
  return {
    buttonCentreX: Math.round(btn.x + btn.width / 2),
    caretCentreX: caret.map((r) => Math.round(r.x + r.width / 2)),
    trayBottom: Math.round(tray.bottom),
    caretCentreY: caret.map((r) => Math.round(r.y + r.height / 2)),
    chip: `${Math.round(chip.width)}x${Math.round(chip.height)}`,
    chipIcon: `${Math.round(icon.width)}x${Math.round(icon.height)}`,
    faces: [...document.querySelectorAll('[role="menuitem"]')].map((e) => e.getAttribute('aria-label')),
  }
})
console.log(JSON.stringify(m, null, 1))
await b.close()
