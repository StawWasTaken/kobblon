import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1280, height: 700 } })
const bad = []
p.on('pageerror', (e) => bad.push(String(e)))
await p.goto('http://localhost:5343/tools/site/quests-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: '/tmp/questcards.png', fullPage: true })
console.log('errors:', bad.slice(0, 3))
await b.close()
