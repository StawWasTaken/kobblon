/*
 * Publishes the design tokens as data.
 *
 * The Launcher and Creator ship with a copy of these so they work before they
 * have talked to anything, and fetch this file at launch so a colour can move
 * without a release. It is generated from `design/tokens.css` and
 * `design/preset.js` rather than typed out, because a hand-written copy is a
 * copy that goes stale the first time somebody is in a hurry.
 *
 * Run: node tools/design/tokens.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import preset from '../../design/preset.js'

const css = readFileSync('design/tokens.css', 'utf8')

/** Pulls one theme's variables out of the stylesheet. */
function theme(selector) {
  const at = css.indexOf(selector)
  if (at < 0) throw new Error(`No ${selector} in design/tokens.css`)
  const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
  const out = {}
  for (const line of body.split('\n')) {
    const match = line.match(/--([a-z-]+):\s*([^;]+);/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

const colors = preset.theme.extend.colors

const tokens = {
  /** Bumped when something in here changes shape, not when a value changes. */
  format: 1,
  updated: new Date().toISOString().slice(0, 10),
  /*
   * Colours that carry meaning and never move with the theme. Brand blue is
   * Kobblon, Space green is something live or something good, and the one red
   * is danger and nothing else.
   */
  fixed: {
    brand: colors.brand,
    space: colors.space,
    danger: colors.danger.DEFAULT,
  },
  /* Surfaces, as "r g b" triples ready for rgb(var(--x) / a). */
  themes: {
    dark: theme(":root[data-theme='dark']"),
    light: theme(":root[data-theme='light']"),
  },
  type: preset.theme.extend.fontFamily,
  radius: preset.theme.extend.borderRadius,
  shadow: preset.theme.extend.boxShadow,
}

writeFileSync('public/brand/tokens.json', `${JSON.stringify(tokens, null, 2)}\n`)
console.log(
  `tokens.json: ${Object.keys(tokens.themes.dark).length} dark, `
  + `${Object.keys(tokens.themes.light).length} light, brand ${tokens.fixed.brand.DEFAULT}`,
)
