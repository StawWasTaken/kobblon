import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 400)))
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 300)) })
p.on('requestfailed', (r) => console.log('[failed]', r.url().slice(0, 140), r.failure()?.errorText))
const where = process.argv[2] ?? '/u/stawwer'
await p.goto('http://localhost:5355' + where, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(9000)
console.log('boot still up:', await p.evaluate(() => !!document.getElementById('boot')))
console.log('root html:', (await p.evaluate(() => document.getElementById('root').innerHTML)).slice(0, 200))
await p.screenshot({ path: '/tmp/deep.png' })
await b.close()
