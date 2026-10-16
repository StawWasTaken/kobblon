/* The byline and the stand-in picture, mounted with nothing around them. */
import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 900, height: 560 } })
page.on('console', (m) => console.log('CONSOLE', m.type(), m.text()))
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message))
await page.goto('http://localhost:5335/tools/site/shop-preview.html', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: '/tmp/shot-shop.png' })
await browser.close()
