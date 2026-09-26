/*
 * A file for every address that points at something.
 *
 * The robots that build a link preview do not run routers, and GitHub Pages
 * cannot tell a robot from a person, so the only way an address like
 * /c/1016/attic-club or /create/SND-1033 can carry its own card is for that
 * address to be a real file. This writes one for every Space, Community,
 * person, event and marketplace upload that is already public, with its name,
 * its words and its picture written in.
 *
 * It reads with the same publishable key the browser carries, so it sees
 * exactly what a stranger sees and nothing more. The deploy runs it again on
 * a schedule, which is how a new Space gets its file.
 *
 * With no network, or with the key missing, it writes nothing and says so:
 * a preview is never worth failing a build over.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { describe, SITE } from './site-pages.mjs'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY

/*
 * The prefix in a marketplace address, and what a kind is called in a
 * sentence.
 *
 * `kindCodes` is read out of `src/lib/kinds.ts` rather than written again
 * here, because this file kept its own copy and the copy went stale the day
 * `model` became `build` and `mesh` arrived: a mesh uploaded that afternoon
 * previewed as `IMG-1122`, which is a different thing entirely. Node cannot
 * import the TypeScript directly, so the one line that matters is read out
 * of it — badly, on purpose, so that it breaks loudly if the shape changes
 * rather than silently going back to a copy.
 */
const kindCodes = (() => {
  const source = readFileSync(new URL('../src/lib/kinds.ts', import.meta.url), 'utf8')
  const line = source.match(/kindCodes[^=]*=\s*\{([^}]*)\}/)
  if (!line) throw new Error('kindCodes is not where write-item-pages expects it in src/lib/kinds.ts')
  return Object.fromEntries(
    [...line[1].matchAll(/(\w+)\s*:\s*'([^']+)'/g)].map(([, kind, code]) => [kind, code]),
  )
})()

/** What that kind is called in a sentence. A card reads as English. */
const kindWords = {
  image: 'A decal', audio: 'A sound', video: 'A video', font: 'A font',
  mesh: 'A mesh', build: 'A build',
}

const count = (n, one, many = `${one}s`) =>
  `${Number(n ?? 0).toLocaleString('en-GB')} ${Number(n ?? 0) === 1 ? one : many}`

/**
 * A card reads best as one sentence saying what the thing is, then whatever
 * its owner wrote about it. Roblox does this and it is the reason their
 * previews say something while ours said the name twice.
 */
const lines = (...parts) => parts.filter(Boolean).join(' ')

const slug = (value) => encodeURIComponent(value)

/** The same shape of address the site writes: lowercase, dashes, nothing else. */
const slugify = (value) => (String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-+|-+$)/g, '') || 'untitled')

/** A card picture has to be somewhere a robot can fetch, over https. */
const picture = (value) => (value && /^https:\/\//.test(value) ? value : null)

/*
 * A preview lives in the one bucket that is public, so it has a plain address
 * with no signature on it and nothing to expire. It is a small picture of the
 * work, not the work: the file itself is in the private bucket and stays
 * there.
 */
const preview = (path) => (
  path ? picture(`${url}/storage/v1/object/public/previews/${path.split('/').map(encodeURIComponent).join('/')}`) : null
)

/*
 * Each kind is asked for on its own: one table refusing to answer should
 * cost that kind its cards, not every kind its cards.
 */
let refused = 0

/*
 * Asking for a column the database has not got yet fails the whole request,
 * which would leave every card for that kind untouched until a migration
 * lands. So a query that mentions something new is asked twice: once as
 * written, and once without it.
 */
async function readOr(table, query, fallback) {
  const rows = await read(table, query, true)
  if (rows) return rows
  console.warn(`Asking ${table} the newer way did not work, so the older one was used.`)
  return read(table, fallback)
}

async function read(table, query, quiet = false) {
  try {
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 200)}`)
    return await response.json()
  } catch (error) {
    if (quiet) return null
    refused += 1
    console.warn(`No cards for ${table}: ${error.message}`)
    return []
  }
}

const shorten = (text, limit = 200) => {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean
}

export async function writeItemPages(into = 'dist') {
  if (!url || !key) {
    rmSync(`${into}/.item-pages`, { force: true })
    console.log('No Supabase details, so no item pages were written.')
    return []
  }

  // A mark left by an earlier run says nothing about this one.
  rmSync(`${into}/.item-pages`, { force: true })

  const document = readFileSync(`${into}/index.html`, 'utf8')
  const pages = []

  const add = (path, page) => pages.push({ path, ...page })

  const [worlds, communities, people, events, style, assets] = await Promise.all([
    /*
     * Worlds, which were Spaces and are read from `worlds` under their own
     * names now. The address moved too: a World lives at /worlds/:id/:slug,
     * and /s/:id/:slug redirects to Discover — so every card written at the
     * old address promised a World and delivered a list, which is worse
     * than no card.
     */
    read('worlds', 'select=content_id,slug,name,description,cover_url,emblem_url,visit_count,like_count,dislike_count,owner:profiles!worlds_owner_id_fkey(username,display_name)&is_published=eq.true&is_removed=eq.false&limit=5000'),
    read('communities', 'select=content_id,slug,name,description,icon_url,banner_url,member_count,owner:profiles!communities_owner_id_fkey(username,display_name)&is_public=eq.true&is_removed=eq.false&limit=5000'),
    read('profiles', 'select=content_id,username,display_name,bio,avatar_url,created_at&is_suspended=eq.false&limit=5000'),
    read('community_events', 'select=content_id,title,subtitle,description,cover_url,starts_at,attending_count,community:communities(name,icon_url,banner_url)&is_cancelled=eq.false&limit=5000'),
    // Everything a stranger can open gets a card, which is anything the
    // review let through. Taking something out of Create hides it from the
    // lists, not from the people you sent the link to, so it keeps its card.
    read('style_items', 'select=content_id,name,description,slot,image_path,price,creator:profiles!style_items_creator_id_fkey(username,display_name)&is_public=eq.true&is_removed=eq.false&limit=5000'),
    readOr(
      'assets',
      'select=content_id,kind,name,description,download_count,created_at,is_public,preview_path,creator:profiles!assets_creator_id_fkey(username,display_name,avatar_url)&status=eq.approved&limit=5000',
      'select=content_id,kind,name,description,download_count,created_at,is_public,creator:profiles!assets_creator_id_fkey(username,display_name,avatar_url)&status=eq.approved&limit=5000',
    ),
  ])

  for (const space of worlds) {
    const by = space.owner?.username ? `@${space.owner.username}` : 'somebody'
    const votes = (space.like_count ?? 0) + (space.dislike_count ?? 0)
    const liked = votes ? `${Math.round(((space.like_count ?? 0) / votes) * 100)}% liked` : null
    const wide = picture(space.cover_url)

    const page = {
      type: 'website',
      title: space.name,
      description: lines(
        `A World on Kobblon by ${by}.`,
        `${count(space.visit_count, 'visit')}${liked ? `, ${liked}` : ''}.`,
        shorten(space.description, 160),
      ),
      image: wide ?? picture(space.emblem_url),
      square: !wide && !!picture(space.emblem_url),
      imageAlt: space.name,
    }
    if (space.content_id) add(`worlds/${space.content_id}/${slug(space.slug)}`, page)
    if (space.owner?.username) add(`u/${slug(space.owner.username)}/${slug(space.slug)}`, page)
  }

  for (const group of communities) {
    const owner = group.owner?.username ? `@${group.owner.username}` : 'somebody'
    // The banner is wide, so it makes the big card; the emblem is square and
    // makes the small one rather than being cut into a stripe.
    const wide = picture(group.banner_url)

    const page = {
      type: 'website',
      title: group.name,
      description: lines(
        `${group.name} is a community on Kobblon, run by ${owner}, with ${count(group.member_count, 'member')}.`,
        shorten(group.description, 160),
      ),
      image: wide ?? picture(group.icon_url),
      square: !wide && !!picture(group.icon_url),
      imageAlt: group.name,
    }
    if (group.content_id) add(`c/${group.content_id}/${slug(group.slug)}`, page)
    add(`c/${slug(group.slug)}`, page)
  }

  for (const person of people) {
    const since = person.created_at
      ? new Date(person.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : null

    const page = {
      type: 'profile',
      title: `${person.display_name} (@${person.username})`,
      description: lines(
        `${person.display_name} is on Kobblon${since ? `, here since ${since}` : ''}.`,
        shorten(person.bio, 160),
      ),
      image: picture(person.avatar_url),
      square: !!picture(person.avatar_url),
      imageAlt: person.display_name,
    }
    if (person.content_id) add(`u/${person.content_id}/${slug(person.username)}`, page)
    add(`u/${slug(person.username)}`, page)
  }

  for (const event of events) {
    if (!event.content_id) continue
    const when = event.starts_at
      ? new Date(event.starts_at).toLocaleDateString('en-GB', {
          weekday: 'long', day: 'numeric', month: 'long',
        })
      : null
    const wide = picture(event.cover_url) ?? picture(event.community?.banner_url)

    const page = {
      type: 'article',
      title: event.title,
      description: lines(
        `An event in ${event.community?.name ?? 'a community'} on Kobblon${when ? `, ${when}` : ''}.`,
        event.attending_count ? `${count(event.attending_count, 'person', 'people')} going.` : null,
        shorten(event.subtitle || event.description, 160),
      ),
      image: wide ?? picture(event.community?.icon_url),
      square: !wide && !!picture(event.community?.icon_url),
      imageAlt: event.title,
    }

    add(`e/${event.content_id}`, page)
    add(`e/${event.content_id}/${slug(slugify(event.title).slice(0, 40) || 'event')}`, page)
  }

  /* Things to wear. The picture is the thing itself, which is already public
     for anything in the shop. */
  const slotWords = {
    hat: 'A hat', hair: 'Hair', face: 'A face', accessory: 'An accessory', frame: 'A frame',
  }

  for (const item of style) {
    if (!item.content_id) continue
    const by = item.creator?.username ? `@${item.creator.username}` : 'somebody'

    add(`style/STY-${item.content_id}`, {
      type: 'website',
      title: item.name,
      description: lines(
        `${slotWords[item.slot] ?? 'Something to wear'} by ${by} on Kobblon Style,`
        + ` ${item.price > 0 ? `${item.price} Brix` : 'free'}.`,
        shorten(item.description, 160),
      ),
      image: picture(item.image_path),
      square: !!picture(item.image_path),
      imageAlt: item.name,
    })
  }

  for (const asset of assets) {
    if (!asset.content_id) continue
    const tag = kindCodes[asset.kind] ?? 'IMG'
    // The file itself is protected, so the card says what it is and who made
    // it and shows none of it.
    const by = asset.creator?.username ? `@${asset.creator.username}` : 'somebody'

    const shot = asset.is_public ? preview(asset.preview_path) : null
    const made = asset.created_at
      ? new Date(asset.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
      : null

    add(`create/${tag}-${asset.content_id}`, {
      type: 'website',
      title: asset.name,
      description: lines(
        `${kindWords[asset.kind] ?? 'Something'} by ${by} on the Kobblon Marketplace, ${tag}-${asset.content_id}${made ? `, up since ${made}` : ''}.`,
        asset.download_count ? `${count(asset.download_count, 'use')}.` : null,
        shorten(asset.description, 160),
      ),
      // The work itself where there is a picture of it: a decal shrunk down,
      // a frame out of a video, drawn by the browser that uploaded it and
      // kept only while the content is listed. The file behind it stays
      // private, and a sound or a font falls back to whoever made it.
      image: shot ?? picture(asset.creator?.avatar_url),
      square: !shot && !!picture(asset.creator?.avatar_url),
      imageAlt: shot
        ? asset.name
        : asset.creator?.display_name
          ? `${asset.creator.display_name} on Kobblon`
          : asset.name,
    })
  }

  for (const page of pages) {
    let html = describe(document, page)
    if (page.image) {
      html = html
        .replace(
          /<meta property="og:image" content="[^"]*" \/>/,
          `<meta property="og:image" content="${page.image}" />`,
        )
        .replace(
          /<meta name="twitter:image" content="[^"]*" \/>/,
          `<meta name="twitter:image" content="${page.image}" />`,
        )
        // An emblem or somebody's picture is square, so a wide card would cut
        // it into a stripe.
        .replace(
          /<meta name="twitter:card" content="[^"]*" \/>/,
          `<meta name="twitter:card" content="${page.square ? 'summary' : 'summary_large_image'}" />`,
        )
      // The size in the template belongs to the brand card. Nobody knows how
      // big somebody's banner is, and a wrong size is worse than none.
      html = html.replace(
        /<meta property="og:image:width" content="[^"]*" \/>\s*<meta property="og:image:height" content="[^"]*" \/>/,
        '',
      )
    }

    const file = `${into}/${page.path}/index.html`
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, html)
  }

  /*
   * A mark for the publish step: with it, this build knows every card there
   * should be and may clear the old ones out. It is only left when every
   * table answered, because a run that could not read one of them does not
   * know what is missing, and must not delete what it cannot see.
   */
  if (refused === 0) {
    writeFileSync(`${into}/.item-pages`, `${pages.length}\n`)
  } else {
    console.warn(`${refused} of the tables did not answer, so published cards are left alone.`)
  }

  console.log(`Wrote ${pages.length} item pages under ${SITE}.`)
  return pages
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeItemPages().catch((error) => {
    console.warn(`No item pages written: ${error.message}`)
  })
}
