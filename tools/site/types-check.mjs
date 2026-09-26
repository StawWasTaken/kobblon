/*
 * What a file is said to be when it is uploaded.
 *
 * Small, but it has already cost a round of confusion: a file whose type the
 * browser did not know went up as application/octet-stream, no bucket allows
 * that, and the error names the type the bucket refused — so somebody
 * uploading an ordinary PNG was told that PNG is not supported.
 *
 * The function is read out of api.ts rather than copied here, so this checks
 * the code that runs rather than a second copy of it that could drift.
 */
import fs from 'fs'
const src = fs.readFileSync('src/lib/api.ts', 'utf8')
const from = src.indexOf('const TYPES: Record<string, string> = {')
const to = src.indexOf('export function worldFileUrl')
const code = src.slice(from, to)
  .replace('const TYPES: Record<string, string> = {', 'const TYPES = {')
  .replace('export function typeOf(file: File, fallback = ', 'function typeOf(file, fallback = ')
const typeOf = new Function(`${code}; return typeOf`)()

const cases = [
  [{ name: 'emblem.png', type: 'image/png' }, undefined, 'image/png', 'a browser that knows is believed'],
  [{ name: 'emblem.png', type: '' }, undefined, 'image/png', 'a PNG with no type is a PNG, not octet-stream'],
  [{ name: 'SHOT.JPEG', type: '' }, undefined, 'image/jpeg', 'the extension is read whatever its case'],
  [{ name: 'clip.mp4', type: '' }, undefined, 'video/mp4', 'a clip too, since 0084 allows them'],
  [{ name: 'part.kbfl', type: '' }, undefined, 'application/json', 'Kobblon own file'],
  [{ name: 'mystery', type: '' }, undefined, 'application/octet-stream', 'no extension falls back, and the bucket refuses it'],
  [{ name: 'mystery.zip', type: '' }, undefined, 'application/octet-stream', 'an extension we do not allow is not invented'],
  [{ name: 'face', type: '' }, 'image/png', 'image/png', 'a caller that knows what it is expecting says so'],
  [{ name: 'statue.obj', type: '' }, undefined, 'model/obj', 'an OBJ, which no browser has a type for'],
  [{ name: 'statue.gltf', type: '' }, undefined, 'model/gltf+json', 'a glTF written as JSON'],
  /*
   * The ordering that matters. Some systems map .obj to application/x-tgif,
   * and the bucket refuses that - so the same upload worked on one laptop
   * and failed on another. Our own mapping wins over the browser's guess
   * for every extension we have an opinion about.
   */
  [{ name: 'statue.obj', type: 'application/x-tgif' }, undefined, 'model/obj', 'and a system that guesses wrongly is overruled'],
  [{ name: 'part.kbfl', type: 'text/plain' }, undefined, 'application/json', 'same for Kobblon own file'],
  [{ name: 'odd.xyz', type: 'application/x-thing' }, undefined, 'application/x-thing', 'but a type we have no opinion about is left alone'],
]

let bad = 0
for (const [file, fallback, want, why] of cases) {
  const got = fallback ? typeOf(file, fallback) : typeOf(file)
  const ok = got === want
  if (!ok) bad += 1
  console.log(ok ? 'PASS' : 'FAIL', why.padEnd(56), got)
}
console.log(`${cases.length - bad}/${cases.length} checks passed`)
process.exit(bad ? 1 : 0)
