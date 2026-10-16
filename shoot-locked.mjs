/* The lockout card, mounted on its own. */
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } })
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto('http://localhost:5335/tools/site/locked-preview.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
await page.screenshot({ path: '/tmp/shot-locked.png' })
await browser.close()
