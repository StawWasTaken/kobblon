/*
 * Reads every migration and complains about the mistakes this project has
 * actually made, rather than the ones a linter imagines.
 *
 * Each rule below cost something once:
 *
 *  - a function pinned to `search_path = public` could not see pgcrypto,
 *    which Supabase keeps in `extensions`. It passed here and failed on the
 *    real database with "function gen_random_bytes(integer) does not exist".
 *  - a migration that is not idempotent cannot be run twice, and every
 *    migration in this repository is run twice before it is pushed.
 *  - a policy or trigger created without dropping the old one first fails the
 *    second time for the same reason.
 *
 * A migration that has already been applied to the live database cannot be
 * edited, so what those files did wrong is recorded in `known.json` beside
 * this script and forgiven. Anything new is not.
 *
 * Run: node scripts/check-migrations.mjs
 */
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const FOLDER = 'supabase/migrations'
const KNOWN = 'scripts/migrations-known.json'

/** Strips comments and strings so a rule cannot match its own explanation. */
function bare(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
}

const rules = [
  {
    name: 'search-path-misses-extensions',
    says: 'a security definer function pinned to `public` alone cannot see pgcrypto',
    find(sql) {
      const found = []
      // Identifiers separated by commas, stopping before the next keyword:
      // a looser class swallows the `as` that follows and reports `publicas`.
      const pattern = /security\s+definer[\s\S]{0,60}?search_path\s*=\s*([a-z_][a-z0-9_]*(?:\s*,\s*[a-z_][a-z0-9_]*)*)/gi
      let match
      while ((match = pattern.exec(sql))) {
        const path = match[1].trim().replace(/\s+/g, '')
        if (!path.split(',').includes('extensions')) found.push(path)
      }
      return found
    },
  },
  {
    name: 'create-table-not-idempotent',
    says: 'use `create table if not exists`, because every migration is run twice',
    find(sql) {
      return [...sql.matchAll(/create\s+table\s+(?!if\s+not\s+exists)([a-z0-9_."]+)/gi)]
        .map((m) => m[1])
    },
  },
  {
    name: 'create-index-not-idempotent',
    says: 'use `create index if not exists`',
    find(sql) {
      return [...sql.matchAll(/create\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists|concurrently)([a-z0-9_."]+)/gi)]
        .map((m) => m[1])
    },
  },
  {
    name: 'policy-without-drop',
    says: 'drop the policy first, or the second run fails',
    find(sql) {
      const dropped = new Set(
        [...sql.matchAll(/drop\s+policy\s+if\s+exists\s+([a-z0-9_]+)/gi)].map((m) => m[1].toLowerCase()),
      )
      return [...sql.matchAll(/create\s+policy\s+([a-z0-9_]+)/gi)]
        .map((m) => m[1])
        .filter((name) => !dropped.has(name.toLowerCase()))
    },
  },
  {
    name: 'trigger-without-drop',
    says: 'drop the trigger first, or the second run fails',
    find(sql) {
      const dropped = new Set(
        [...sql.matchAll(/drop\s+trigger\s+if\s+exists\s+([a-z0-9_]+)/gi)].map((m) => m[1].toLowerCase()),
      )
      return [...sql.matchAll(/create\s+(?:or\s+replace\s+)?trigger\s+([a-z0-9_]+)/gi)]
        .map((m) => m[1])
        .filter((name) => !dropped.has(name.toLowerCase()))
    },
  },
  {
    name: 'bad-filename',
    says: 'name it NNNN_what_it_does.sql',
    find(_sql, file) {
      return /^\d{4}_[a-z0-9_]+\.sql$/.test(file) ? [] : [file]
    },
  },
]

const files = readdirSync(FOLDER).filter((f) => f.endsWith('.sql')).sort()
const known = existsSync(KNOWN) ? JSON.parse(readFileSync(KNOWN, 'utf8')) : {}
const writing = process.argv.includes('--write-known')

const found = {}
let fresh = 0

for (const file of files) {
  const sql = bare(readFileSync(join(FOLDER, file), 'utf8'))
  for (const rule of rules) {
    const hits = rule.find(sql, file)
    if (!hits.length) continue
    found[file] = found[file] ?? {}
    found[file][rule.name] = hits

    const forgiven = known[file]?.[rule.name] ?? []
    const newOnes = hits.filter((hit) => !forgiven.includes(hit))
    if (newOnes.length && !writing) {
      fresh += newOnes.length
      console.log(`${file}`)
      console.log(`  ${rule.name}: ${rule.says}`)
      for (const one of newOnes) console.log(`    ${one}`)
    }
  }
}

if (writing) {
  writeFileSync(KNOWN, `${JSON.stringify(found, null, 2)}\n`)
  console.log(`Recorded what ${Object.keys(found).length} already applied migrations do.`)
  process.exit(0)
}

const duplicates = files
  .map((f) => f.slice(0, 4))
  .filter((n, at, all) => all.indexOf(n) !== at)

if (duplicates.length) {
  console.log(`Two migrations share a number: ${[...new Set(duplicates)].join(', ')}`)
  fresh += duplicates.length
}

if (fresh) {
  console.log(`\n${fresh} thing${fresh === 1 ? '' : 's'} to fix before this is pushed.`)
  process.exit(1)
}

console.log(`${files.length} migrations, nothing new to complain about.`)
