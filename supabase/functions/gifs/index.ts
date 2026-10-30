/*
 * GIFs, fetched for a signed-in person without handing anybody the key.
 *
 * Klipy wants an API key on every request. A key in the website's bundle is
 * a key everybody has - client-side JavaScript is readable by definition -
 * so the search happens here, where `KLIPY_KEY` is an environment secret,
 * and the page only ever sees the pictures that came back.
 *
 * It is deliberately not in `supabase/config.toml`, which means Supabase
 * turns away a caller with no session. Searching GIFs is a thing members
 * do in a chat; it is not a public search endpoint with Kobblon paying for
 * it.
 *
 * What it returns is the shape the card draws and nothing else: an id, the
 * address of the picture, and the size it is. Klipy's own answer carries
 * more - trackers, ad slots, several encodings - and none of that is the
 * website's business.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })

/** Klipy's base. The key goes in the path, which is how Klipy is addressed. */
const KLIPY = 'https://api.klipy.co/api/v1'

type Gif = { id: string; url: string; width: number; height: number }

/*
 * Klipy answers with a list of items, each holding several encodings of the
 * same GIF under `file`. Which keys are present varies by item, so this
 * takes the first one that is there rather than naming one and hoping.
 * Anything it cannot read the size of is dropped: the card lays the
 * pictures out by their own proportions, and one with no size in it is the
 * one that makes the column jump when it loads.
 */
function pictureOf(item: Record<string, unknown>): Gif | null {
  const id = String(item.id ?? item.slug ?? '')
  const file = (item.file ?? {}) as Record<string, Record<string, Record<string, unknown>>>
  const sizes = file.md ?? file.sm ?? file.hd ?? file.xs ?? {}
  const one = (sizes.gif ?? sizes.webp ?? sizes.mp4 ?? {}) as Record<string, unknown>
  const url = String(one.url ?? '')
  const width = Number(one.width ?? 0)
  const height = Number(one.height ?? 0)
  if (!id || !url || !width || !height) return null
  return { id, url, width, height }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return answer({ error: 'POST only' }, 405)

  const key = Deno.env.get('KLIPY_KEY')
  /*
   * Said plainly rather than as an empty list. The card asks once whether
   * GIFs work at all and only draws its button if they do, so "no key set"
   * has to be tellable from "nothing matched that word" - otherwise the
   * button is there and the card is for ever empty, which is the fake
   * control `docs/neoclassic.md` is about.
   */
  if (!key) return answer({ error: 'no-key' }, 503)

  let asked: { q?: string; page?: number } = {}
  try {
    asked = await request.json()
  } catch {
    return answer({ error: 'bad-request' }, 400)
  }

  const q = String(asked.q ?? '').trim().slice(0, 60)
  const page = Math.min(Math.max(Number(asked.page ?? 1) || 1, 1), 20)

  /*
   * A person who is signed in asks as themselves. Klipy wants a customer
   * id for its own counting, and the honest one is the account - but the
   * account id is nobody else's business, so what goes over is a number
   * derived from it rather than the id itself.
   */
  const who = request.headers.get('authorization') ?? ''
  let stamp = 0
  for (let at = 0; at < who.length; at += 1) stamp = (stamp * 31 + who.charCodeAt(at)) % 1_000_003

  const where = q
    ? `${KLIPY}/${key}/gifs/search?q=${encodeURIComponent(q)}&page=${page}&per_page=24&customer_id=${stamp}`
    : `${KLIPY}/${key}/gifs/trending?page=${page}&per_page=24&customer_id=${stamp}`

  try {
    const got = await fetch(where, { headers: { accept: 'application/json' } })
    if (!got.ok) return answer({ error: 'klipy', status: got.status }, 502)

    const body = await got.json() as Record<string, unknown>
    const data = (body.data ?? body) as Record<string, unknown>
    const rows = (Array.isArray(data) ? data : data.data ?? []) as Record<string, unknown>[]

    return answer({ items: rows.map(pictureOf).filter(Boolean) as Gif[] })
  } catch {
    return answer({ error: 'klipy' }, 502)
  }
})
