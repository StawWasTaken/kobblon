import { chromium } from 'playwright'
const base = process.argv[2] || 'http://localhost:5343'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } })
await p.goto(base + '/tools/site/quests-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)
await p.screenshot({ path: '/tmp/shot-questcards.png', fullPage: true })
console.log((await p.locator('body').innerText()).replace(/\n+/g, ' | ').slice(0, 600))
await b.close()
