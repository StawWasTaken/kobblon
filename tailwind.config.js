import kobblon from './design/preset.js'

/**
 * The website's Tailwind, which is the shared preset and nothing else.
 *
 * Everything that decides how Kobblon looks lives in `design/`, so the
 * Launcher and Creator can extend exactly the same thing rather than a copy
 * of it that drifts a shade at a time.
 */
/** @type {import('tailwindcss').Config} */
export default {
  presets: [kobblon],
  content: ['./index.html', './src/**/*.{ts,tsx}', './tools/**/*.{ts,tsx,html}'],
  plugins: [],
}
