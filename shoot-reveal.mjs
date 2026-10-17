import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
for (const round of ['first arrival', 'a refresh in the same tab']) {
  const began = Date.now()
  await p.goto('http://localhost:5355/discover', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => !document.getElementById('boot'), null, { timeout: 20000 })
  console.log(round + ':', Date.now() - began, 'ms until the mark went')
}
await b.close()
