/* The forum's new pieces, on the bare page that mounts them. */
import { chromium } from 'playwright'

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage({ viewport: { width: 1480, height: 1000 }, deviceScaleFactor: 2 })

const bad = []
p.on('pageerror', (e) => bad.push('threw: ' + e.message))

await p.goto('http://localhost:5343/tools/site/forum-preview.html', { waitUntil: 'networkidle' })
await p.waitForTimeout(1200)

/*
 * The rows, by the heading each one opens with.
 *
 * It used to read `section > p` and index `section` by the position in
 * that list, which is only the same list while every row holds exactly one
 * paragraph - and `RelatedTopics` mounts sections of its own, so from that
 * row onwards every number was three out. The shots were of the wrong
 * rows and looked plausible, which is the whole trouble with it.
 */
const names = await p.locator('section').evaluateAll(
  (all) => all.map((one) => one.querySelector(':scope > p')?.textContent ?? ''))
console.log(names.map((n, i) => `${i}: ${n}`).join('\n'))

const shot = async (n, name) =>
  p.locator('section').nth(n).screenshot({ path: `/tmp/forum-${name}.png` })

const at = (label) => names.findIndex((n) => n.includes(label))
await shot(at('status pairs'), 'status')
await shot(at('clip and a picture'), 'attachments')
await shot(at('foot of the page'), 'footer')
/* The second box typed into, so the clear button is in the shot. */
await p.locator('section').nth(at('search box')).locator('input').nth(1).fill('door will not open')
await p.waitForTimeout(200)
await shot(at('search box'), 'search')
await shot(at('Older and newer'), 'pager')
await shot(at('looks after this board'), 'minders')
await shot(at('searched words picked out'), 'marked')
await shot(at('quote landing'), 'quote')

/* Quote twice, with something typed in between, and look at the box. */
const quoteRow = p.locator('section').nth(at('quote landing'))
await quoteRow.getByRole('button', { name: 'Quote Pixelhead' }).click()
await p.waitForTimeout(300)
await quoteRow.getByRole('button', { name: 'Quote Pixelhead' }).click()
await p.waitForTimeout(300)
await shot(at('quote landing'), 'quote-twice')
console.log('the box holds:', JSON.stringify(
  await quoteRow.locator('textarea').inputValue()))

/* The viewer, open over the clip. */
await p.locator('section').nth(at('clip and a picture')).locator('button').nth(1).click()
await p.waitForTimeout(600)
await p.screenshot({ path: '/tmp/forum-lightbox.png' })

console.log(bad.length ? bad.join(' | ') : 'nothing threw')
await b.close()
