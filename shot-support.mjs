import { chromium } from 'playwright'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message))

for (const [which, shots] of [
  ['ticket', ['who']],
  ['business', ['topic', 'you']],
  ['out', ['you']],
]) {
  await page.goto(`http://localhost:5343/tools/site/popups-preview.html?v=${which}`)
  await page.waitForTimeout(900)
  await page.screenshot({ path: `/tmp/sup-${which}-0.png` })
  if (which === 'business') {
    // The box is already picked by `startKind`, so this is Next, then the
    // topic, then the message, then the last step.
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Investing', exact: true }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: '/tmp/sup-business-topic.png' })
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(300)
    await page.getByPlaceholder('The short version').fill('Investment in Kobblon')
    await page.locator('#ticket-body').fill('We are a small fund and would like to talk about putting money into Kobblon this year.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: '/tmp/sup-business-you.png' })
  }
  if (which === 'out') {
    await page.getByRole('button', { name: /I use Kobblon/ }).click()
    await page.waitForTimeout(300)
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: 'Account', exact: true }).click()
    await page.waitForTimeout(200)
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(300)
    await page.getByPlaceholder('The short version').fill('I cannot sign in')
    await page.locator('#ticket-body').fill('The email on my account is one I do not have any more and I cannot get the code.')
    await page.getByRole('button', { name: 'Next' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: /Computer/ }).click()
    await page.waitForTimeout(400)
    await page.screenshot({ path: '/tmp/sup-out-you.png' })
  }
  console.log(which, 'ok', shots.join(','))
}
await browser.close()
