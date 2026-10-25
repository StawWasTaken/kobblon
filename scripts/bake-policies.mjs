/*
 * The policies, as plain text the edge function can read.
 *
 * `src/content/policies.ts` is the one copy of Kobblon's rules and stays
 * that way - this writes a derived JSON file next to the `moderate`
 * function so Kobby can answer questions about them without the policies
 * being typed out a second time somewhere nobody remembers to update.
 *
 * It is derived and not edited: `npm run build` bakes it, so the file in
 * the repository is whatever the documents say at the commit that built
 * it. The one rule for anybody touching this: never let the browser send
 * the policy text to the function instead. A question is untrusted and a
 * document is not, and a model handed both from the same place will
 * happily quote a rule somebody invented on the way in.
 */
import { rolldown } from 'rolldown'
import path from 'node:path'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const out = path.join(root, 'supabase/functions/moderate/policies.json')

const bundle = await rolldown({
  input: path.join(root, 'src/content/policies.ts'),
  platform: 'node',
  resolve: { alias: { '@': path.join(root, 'src') } },
})
const { output } = await bundle.generate({ format: 'esm' })

const where = await mkdtemp(path.join(tmpdir(), 'policies-'))
const file = path.join(where, 'policies.mjs')
await writeFile(file, output[0].code)
const { policies } = await import(pathToFileURL(file).href)
await rm(where, { recursive: true, force: true })

/* Flattened to the words and nothing else. The model reads prose; a list of
   points is prose with a dash in front of it, and the headings are what let
   an answer say which clause it came out of. */
const baked = policies.map((one) => ({
  slug: one.slug,
  title: one.title,
  blurb: one.blurb,
  updated: one.updated,
  text: [
    one.intro,
    ...one.sections.map((part) => [
      `## ${part.heading}`,
      ...part.body,
      ...(part.points ?? []).map((p) => `- ${p.label}${p.note ? `: ${p.note}` : ''}`),
    ].join('\n')),
  ].join('\n\n'),
}))

await writeFile(out, `${JSON.stringify(baked, null, 2)}\n`)
const size = baked.reduce((n, one) => n + one.text.length, 0)
console.log(`Baked ${baked.length} policies, ${size.toLocaleString()} characters.`)
