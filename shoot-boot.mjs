import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [mode, look] of [['dark', 'halloween'], ['light', 'default'], ['dark', 'christmas']]) {
  const p = await b.newPage({ viewport: { width: 700, height: 400 } })
  await p.addInitScript(`try {
    localStorage.setItem('kobblon.theme', '${mode}')
    localStorage.setItem('kobblon.appearance', '${look}')
  } catch (e) {}`)
  await p.route('**/assets/*.js', (route) => route.abort())
  await p.goto('http://localhost:5399/', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  console.log(mode, look, await p.evaluate(() => {
    const boot = document.getElementById('boot')
    return boot ? [boot.dataset.ink, getComputedStyle(boot).backgroundColor].join(' ') : 'no boot'
  }))
  await p.screenshot({ path: `/tmp/boot-${mode}-${look}.png` })
  await p.close()
}
await b.close()
