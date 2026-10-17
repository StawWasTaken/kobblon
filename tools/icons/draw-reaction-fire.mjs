/*
 * The fire reaction.
 *
 * Staw asked for one - "you shall a fire reaction" - and did not draw it.
 * Every other face in this set is his, so rather than invent something in
 * his hand, this is Font Awesome's solid flame, which is the fallback he
 * has set down for exactly this: "always use filled svg icons from
 * fontawesome or images i provided to you".
 *
 * It is written out as a 96px mask like the rest of `public/icons/ui`, so
 * `Icon` paints it the same way it paints everything else and it takes its
 * colour the same way. When Staw draws a flame, dropping his file over this
 * one is the whole of the change.
 *
 * Run it with `node tools/icons/draw-reaction-fire.mjs`. The file it writes
 * is committed; nothing in the build runs it.
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
import { faFire } from '@fortawesome/free-solid-svg-icons'

const [width, height, , , path] = faFire.icon
const SIZE = 96

/*
 * Centred in a square and inset a little, because a flame drawn edge to
 * edge next to faces that have a margin reads as bigger than they are
 * rather than as the same size.
 */
const scale = (SIZE * 0.88) / Math.max(width, height)
const left = (SIZE - width * scale) / 2
const top = (SIZE - height * scale) / 2

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`
  + `<g transform="translate(${left} ${top}) scale(${scale})">`
  + `<path d="${path}" fill="#ffffff"/>`
  + '</g></svg>'

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE } })
await page.setContent(
  `<body style="margin:0;background:transparent">${svg}</body>`,
)
const shot = await page.screenshot({ omitBackground: true })
writeFileSync('public/icons/ui/reaction-fire.png', shot)
await browser.close()
console.log('public/icons/ui/reaction-fire.png')
