import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 900, height: 1100 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 300)))

await p.goto('http://localhost:5343/tools/site/reactions-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1500)

// The second bar's own button, so the tray in the shot is the real one.
const openers = p.locator('button[aria-label="React"]')
await openers.nth(1).click()
await p.mouse.move(850, 950)
await p.waitForTimeout(600)

await p.screenshot({ path: '/tmp/reactions.png', fullPage: true })
await b.close()
