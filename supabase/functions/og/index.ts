// The link preview for an address that only the database knows about.
//
// Kobblon is one document with a router inside it. The robots that build a
// preview in Discord, Slack or a search result do not run routers: they read
// whatever HTML they are handed. Every address that reads the same for
// everybody already has its own file, written at build time. This is for the
// rest: a Space, a Community, a person, an event, an upload.
//
// It answers with a small document carrying the card and nothing else, and
// sends a person who lands on it to the real address straight away. Put
// something in front of the site that routes preview robots here; docs/
// embeds.md says how.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SITE = 'https://kobblon.com'
const FALLBACK_IMAGE = `${SITE}/brand/og.png`
const TAGLINE = 'make something nobody else has'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  // The anon key is enough: link_preview only ever returns things that are
  // already public, and it is the same key the browser carries.
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
)

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/**
 * A picture has to be somewhere a robot can reach, over https.
 *
 * Two kinds come back. An avatar, an emblem or an event cover is stored as a
 * full address already and is used as it is. A Marketplace card is stored as
 * a **path inside the `previews` bucket** - the database has no business
 * knowing this project's host, so it returns the path and the address is
 * built here, where the host is.
 *
 * Anything else, and anything missing, falls back to Kobblon's own card. A
 * robot handed a broken address shows a link with a grey box on it, which is
 * worse than a link with the right logo on it.
 */
const pictureOf = (image: string | null) => {
  if (!image) return FALLBACK_IMAGE
  if (/^https:\/\//.test(image)) return image
  const { data } = supabase.storage.from('previews').getPublicUrl(image)
  return data?.publicUrl && /^https:\/\//.test(data.publicUrl)
    ? data.publicUrl
    : FALLBACK_IMAGE
}

const card = (
  { url, title, description, image, square }:
  { url: string; title: string; description: string; image: string; square: boolean },
) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escape(title)}</title>
<link rel="canonical" href="${escape(url)}" />
<meta name="description" content="${escape(description)}" />
<meta name="theme-color" content="#101012" />
<meta property="og:site_name" content="Kobblon" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${escape(url)}" />
<meta property="og:title" content="${escape(title)}" />
<meta property="og:description" content="${escape(description)}" />
<meta property="og:image" content="${escape(image)}" />
<meta name="twitter:card" content="${square ? 'summary' : 'summary_large_image'}" />
<meta name="twitter:title" content="${escape(title)}" />
<meta name="twitter:description" content="${escape(description)}" />
<meta name="twitter:image" content="${escape(image)}" />
<meta http-equiv="refresh" content="0; url=${escape(url)}" />
</head>
<body style="background:#101012;color:#fff;font-family:system-ui,sans-serif;padding:2rem">
<p><a href="${escape(url)}" style="color:#4d63ff">${escape(title)}</a></p>
<script>location.replace(${JSON.stringify(url)})</script>
</body>
</html>`

Deno.serve(async (request) => {
  const asked = new URL(request.url)
  // Either ?path=/c/1016/name, or whatever follows the function's own name.
  const path = asked.searchParams.get('path')
    ?? asked.pathname.replace(/^\/functions\/v1\/og/, '')
    || '/'

  const url = `${SITE}${path.startsWith('/') ? path : `/${path}`}`

  let title = 'Kobblon'
  let description = `${TAGLINE}. Build your own Space, fill it with whatever you want, and let people in.`
  let image = FALLBACK_IMAGE
  let square = false

  try {
    const { data } = await supabase.rpc('link_preview', { path })
    const found = Array.isArray(data) ? data[0] : data
    if (found?.title) {
      title = `${found.title} - Kobblon`
      description = found.description ?? description
      image = pictureOf(found.image ?? null)
      /*
       * An emblem and a picture of somebody are square, so a wide card would
       * crop them to a stripe. A mesh card is square too, and transparent -
       * `link_preview` says which rows want the small card through `wide`,
       * and this is the only place that knows what to do with the answer.
       */
      square = image !== FALLBACK_IMAGE
        && (found.kind === 'community' || found.kind === 'person'
            || found.wide === false)
    }
  } catch {
    // A preview is never worth failing a page load over: the site's own card
    // stands in.
  }

  return new Response(card({ url, title, description, image, square }), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Long enough that a busy channel does not hammer the database, short
      // enough that renaming a Community shows up the same day.
      'Cache-Control': 'public, max-age=600, s-maxage=600',
    },
  })
})
