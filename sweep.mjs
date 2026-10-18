import { chromium } from 'playwright'

const pages = [
  ['landing', '/'],
  ['discover', '/discover'],
  ['communities', '/communities'],
  ['people', '/people'],
  ['catalog', '/catalog'],
  ['create', '/create'],
  ['profile', '/u/Kobblon'],
  ['login', '/login'],
  ['signup', '/signup'],
  ['terms', '/terms'],
  ['support', '/support'],
]

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [name, path] of pages) {
  const p = await b.newPage({ viewport: { width: 1400, height: 1000 } })
  const noise = []
  p.on('pageerror', (e) => noise.push('throw: ' + String(e).slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') noise.push('console: ' + m.text().slice(0, 160)) })
  p.on('response', (r) => { if (r.status() >= 400) noise.push(`${r.status()} ${r.url().split('/').slice(3).join('/').slice(0, 90)}`) })
  await p.goto('http://localhost:5399' + path, { waitUntil: 'networkidle' }).catch((e) => noise.push('goto: ' + e.message.slice(0, 80)))
  await p.waitForTimeout(3500)
  await p.screenshot({ path: `/tmp/sweep-${name}.png`, fullPage: false })
  const heading = await p.evaluate(() => document.querySelector('h1, h2')?.textContent?.slice(0, 60) ?? '(none)')
  console.log(`\n== ${name} ${path} :: ${heading}`)
  for (const line of [...new Set(noise)].slice(0, 6)) console.log('   ', line)
  await p.close()
}
await b.close()
