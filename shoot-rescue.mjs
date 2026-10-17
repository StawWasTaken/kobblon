import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
await p.goto('http://localhost:5355/u/ALT', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(9000)
console.log('ended up at:', await p.evaluate(() => location.pathname + location.search))
console.log('boot still up:', await p.evaluate(() => !!document.getElementById('boot')))
await b.close()
