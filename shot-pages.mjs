import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1280, height: 1400 } })
p.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))
await p.goto('http://localhost:5349/support', { waitUntil: 'networkidle' }).catch(() => {})
await p.waitForTimeout(4000)
await p.screenshot({ path: '/tmp/page-support.png', fullPage: true })
console.log('support shot')
await b.close()
