import { chromium } from 'playwright'

const base = process.argv[2] || 'http://localhost:5400'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

for (const [name, path, size] of [
  ['quests', '/quests', { width: 1280, height: 1100 }],
]) {
  const p = await b.newPage({ viewport: size })
  await p.goto(base + path, { waitUntil: 'networkidle' })
  await p.waitForTimeout(1500)
  await p.screenshot({ path: `/tmp/shot-${name}.png`, fullPage: true })
  console.log(name, 'title:', await p.title())
  console.log(name, 'text:', (await p.locator('body').innerText()).slice(0, 400).replace(/\n+/g, ' | '))
  await p.close()
}
await b.close()
