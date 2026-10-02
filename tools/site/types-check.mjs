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

/*
 * Where a card's picture comes from.
 *
 * Read out of preview.ts for the same reason as above: the thing that runs,
 * not a copy of it. This one has broken the site twice - once by signing a
 * public path against the private bucket, once by showing a card that had
 * had its transparency flattened to black in preference to the file that
 * still had it. Both were a wrong answer to "which of the three", and both
 * were invisible until somebody looked at a page.
 */
const psrc = fs.readFileSync('src/lib/preview.ts', 'utf8')
const pfrom = psrc.indexOf('export function pictureFrom(')
/*
 * Reading one function out of a TypeScript file and running it in node.
 *
 * Node has never heard of a type, so the signature has to go and the body
 * has to stay. Counting brackets rather than matching a pattern: the
 * parameter list here is an object type full of braces and pipes, and every
 * expression that tried to describe that shape was wrong in a way that only
 * showed up as a syntax error from `new Function`.
 */
function bodyOf(source, name) {
  const at = source.indexOf(`export function ${name}(`)
  if (at < 0) throw new Error(`no ${name} in that file`)

  // The closing bracket of the parameter list.
  let i = source.indexOf('(', at)
  let depth = 0
  for (; i < source.length; i += 1) {
    if (source[i] === '(') depth += 1
    else if (source[i] === ')') { depth -= 1; if (depth === 0) break }
  }
  /*
   * Then the brace that opens the body - past the return type, which is
   * itself written in braces here. Taking the first brace after the
   * parameters gave `{ direct; signed }` as the whole function, which ran
   * and threw about an undefined name rather than failing to parse.
   */
  let after = i + 1
  while (/\s/.test(source[after])) after += 1
  /*
   * Only skip a return annotation that is itself written in braces, like
   * `: { direct, signed }`. A plain one such as `: boolean` needs no
   * skipping, and treating it as braces walks straight into the body and
   * out the other side - which came back as a function from somewhere else
   * in the file complaining about a name it had never heard of.
   */
  let annotationIsBraces = false
  if (source[after] === ':') {
    let k = after + 1
    while (/\s/.test(source[k])) k += 1
    annotationIsBraces = source[k] === '{'
  }
  if (annotationIsBraces) {
    const annotation = source.indexOf('{', after)
    let inside = 0
    for (let k = annotation; k < source.length; k += 1) {
      if (source[k] === '{') inside += 1
      else if (source[k] === '}') { inside -= 1; if (inside === 0) { after = k + 1; break } }
    }
  }
  const open = source.indexOf('{', after)
  let braces = 0
  let j = open
  for (; j < source.length; j += 1) {
    if (source[j] === '{') braces += 1
    else if (source[j] === '}') { braces -= 1; if (braces === 0) break }
  }
  return source.slice(open + 1, j).replace(/: string \| null/g, '')
}

const pictureFrom = new Function('item',
  `const PREVIEW_EXTENSION = 'webp';\n${bodyOf(psrc, 'pictureFrom')}`)

/*
 * Whether a stored card was drawn by the drawing that runs today.
 *
 * Read out of the file the same way, because the whole point of the mark is
 * that a change to it reaches every picture already drawn - and a check that
 * had its own copy of the mark would keep passing after somebody bumped it
 * and forgot one of the two places.
 */
const markMatch = psrc.match(/export const CARD_MARK = '([^']+)'/)
if (!markMatch) throw new Error('no CARD_MARK in preview.ts')
const CARD_MARK = markMatch[1]
const cardIsCurrent = new Function('path',
  `const CARD_MARK = ${JSON.stringify(CARD_MARK)};\n${
    bodyOf(psrc, 'cardIsCurrent').replace(/^\s*=>/, 'return').replace(/;?\s*$/, '')}`)

const picked = [
  [{ kind: 'image', file_path: 'u/a.png', preview_path: 'p/a.webp' },
   { direct: 'p/a.webp', signed: null },
   'a Decal with a card that can hold transparency uses the card'],
  [{ kind: 'image', file_path: 'u/a.png', preview_path: 'p/a.jpg' },
   { direct: null, signed: 'u/a.png' },
   'a Decal whose card was flattened to black uses its own file instead'],
  [{ kind: 'image', file_path: 'u/a.png' },
   { direct: null, signed: 'u/a.png' },
   'a Decal with no card at all uses its own file'],
  [{ kind: 'mesh', file_path: 'u/a.obj', preview_path: 'p/a.jpg' },
   { direct: 'p/a.jpg', signed: null },
   'a mesh keeps an old card, because a model is not something an img shows'],
  [{ kind: 'mesh', file_path: 'u/a.obj', preview_path: 'p/a.webp' },
   { direct: 'p/a.webp', signed: null },
   'and uses a new one when it has one'],
  [{ kind: 'audio', file_path: 'u/a.mp3' },
   { direct: null, signed: null },
   'a sound has nothing to show and nothing is invented'],
  [{ kind: 'image', file_path: 'u/a.png', thumbnail_path: 't/old.jpg' },
   { direct: null, signed: 't/old.jpg' },
   'the oldest column still wins over the file, for anything that has one'],
  [{ kind: 'image', file_path: 'u/a.png', preview_path: 'p/A.WEBP' },
   { direct: 'p/A.WEBP', signed: null },
   'and the extension is read whatever its case'],
]

for (const [item, want, why] of picked) {
  const got = pictureFrom(item)
  const ok = got.direct === want.direct && got.signed === want.signed
  if (!ok) bad += 1
  console.log(ok ? 'PASS' : 'FAIL', why.padEnd(66),
    `direct=${got.direct} signed=${got.signed}`)
}

const marks = [
  [`me/abc.${CARD_MARK}.webp`, true, 'a card drawn by the drawing that runs today is current'],
  ['me/abc.webp', false, 'one drawn before the mark existed is not, however good the format'],
  ['me/abc.k1.webp', false, 'and nor is one from an earlier generation of the drawing'],
  [null, false, 'no card at all is not a current card'],
  [`me/ABC.${CARD_MARK.toUpperCase()}.WEBP`, true, 'the mark is read whatever its case'],
]
for (const [path, want, why] of marks) {
  const got = !!cardIsCurrent(path)
  const ok = got === want
  if (!ok) bad += 1
  console.log(ok ? 'PASS' : 'FAIL', why.padEnd(66), `${got}`)
}

const total = cases.length + picked.length + marks.length
console.log(`${total - bad}/${total} checks passed`)
process.exit(bad ? 1 : 0)
