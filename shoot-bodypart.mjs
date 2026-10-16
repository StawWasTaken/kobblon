/*
 * The plain torso beside the shaped one, undressed and with the same shirt
 * on both. The shirt is the thing to look at: if a shape has left the box
 * the sheet is measured against, it is the shirt that shows it.
 */
import { chromium } from 'playwright'

const b = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const p = await b.newPage({ viewport: { width: 820, height: 560 } })
p.on('pageerror', (e) => console.log('[throw]', String(e).slice(0, 400)))
p.on('console', (m) => console.log('[log]', m.text().slice(0, 200)))

const page = 'http://localhost:5343/tools/site/bodypart-preview.html'

await p.goto(page, { waitUntil: 'networkidle' })
await p.waitForTimeout(6000)
await p.screenshot({ path: '/tmp/shot-bodypart.png' })

// Dressed from the start rather than by pressing the button: the stands
// rebuild on the press, and the shot was taken while they were doing it.
await p.goto(`${page}?dressed=1`, { waitUntil: 'networkidle' })
await p.waitForTimeout(6000)
await p.screenshot({ path: '/tmp/shot-bodypart-shirt.png' })

await b.close()
