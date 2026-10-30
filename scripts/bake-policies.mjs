/*
 * The policies and the help articles, as plain text the edge function can
 * read.
 *
 * `src/content/policies.ts` is the one copy of Kobblon's rules and
 * `src/content/help.ts` is the one copy of the how-to; both stay that way -
 * this writes a derived JSON file next to the `moderate` function so Kobby
 * can answer questions about them without either being typed out a second
 * time somewhere nobody remembers to update.
 *
 * Both corpora land in one array because the question decides which one it
 * wants, not the page it was asked from: "can I get my money back" is half
 * a rule and half a procedure, and a Kobby that could only see one half
 * would answer the wrong one confidently. Each entry carries `at`, the
 * address of the page it came from, so an answer can link to the document
 * it used rather than to a guess at where that document lives.
 *
 * It is derived and not edited: `npm run build` bakes it, so the file in
 * the repository is whatever the documents say at the commit that built
 * it. The one rule for anybody touching this: never let the browser send
 * the text to the function instead. A question is untrusted and a document
 * is not, and a model handed both from the same place will happily quote a
 * rule somebody invented on the way in.
 */
import { rolldown } from 'rolldown'
import path from 'node:path'
import { writeFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { pathToFileURL } from 'node:url'

const root = process.cwd()
const out = path.join(root, 'supabase/functions/moderate/policies.json')

/** Bundles one content file and hands back what it exports. */
async function contentsOf(from) {
  const bundle = await rolldown({
    input: path.join(root, from),
    platform: 'node',
    resolve: { alias: { '@': path.join(root, 'src') } },
  })
  const { output } = await bundle.generate({ format: 'esm' })
  const where = await mkdtemp(path.join(tmpdir(), 'baked-'))
  const file = path.join(where, 'baked.mjs')
  await writeFile(file, output[0].code)
  const loaded = await import(pathToFileURL(file).href)
  await rm(where, { recursive: true, force: true })
  return loaded
}

const { policies } = await contentsOf('src/content/policies.ts')
const { helpArticles } = await contentsOf('src/content/help.ts')

/* Flattened to the words and nothing else. The model reads prose; a list of
   points is prose with a dash in front of it, and the headings are what let
   an answer say which clause it came out of. */
const flatten = (one, at) => ({
  slug: one.slug,
  title: one.title,
  blurb: one.blurb,
  updated: one.updated,
  at: `${at}/${one.slug}`,
  kind: at === '/policies' ? 'policy' : 'help',
  text: [
    one.intro,
    ...one.sections.map((part) => [
      `## ${part.heading}`,
      ...part.body,
      ...(part.points ?? []).map((p) => `- ${p.label}${p.note ? `: ${p.note}` : ''}`),
    ].join('\n')),
  ].join('\n\n'),
})

const baked = [
  ...policies.map((one) => flatten(one, '/policies')),
  ...helpArticles.map((one) => flatten(one, '/support/h')),
]

/* Two documents sharing a slug would make the function's own check - which
   filters the model's named sources against this list - pick whichever came
   first, and link an answer about the rules at a help article or the other
   way round. Caught here, where it is one line, rather than in an answer. */
const seen = new Set()
for (const one of baked) {
  if (seen.has(one.slug)) throw new Error(`Two documents are both called "${one.slug}".`)
  seen.add(one.slug)
}

await writeFile(out, `${JSON.stringify(baked, null, 2)}\n`)
const size = baked.reduce((n, one) => n + one.text.length, 0)
console.log(
  `Baked ${policies.length} policies and ${helpArticles.length} help articles, `
  + `${size.toLocaleString()} characters.`,
)
