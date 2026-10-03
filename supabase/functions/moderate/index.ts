/*
 * The moderation worker: what the machine looks at, and what it says.
 *
 * Staw asked for Groq to do the screening when a person has not got to it -
 * "only if taking too long ... or only if theres too much or just do always
 * when there's some work to do" - and for hard limits on what it may do to
 * people: "ONLY WARNINGS AND SUSPENSIONS, AI CANNOT DELETE AN ACCOUNT".
 *
 * **Those limits are not in this file.** They are in the database, in
 * `apply_ai_verdict`, which is the only door this has. That is deliberate:
 * this is a program on a server that anybody with the keys can redeploy, and
 * a rule that lives here lasts until somebody edits it. What lives here is
 * the asking - the prompt, the model, the parsing - and nothing else.
 *
 * This holds the service role, like `app-signin` does, and for the same
 * reason: what it does needs rights no browser may have. The key never
 * leaves the server, and the Groq key never leaves it either.
 *
 * Who may set it going:
 *
 *   * a signed-in Kobblon admin, pressing the button in the staff console;
 *   * anything holding the service role, which is how a schedule calls it.
 *
 * Nobody else, and the database would refuse the verdicts anyway.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const answer = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const GROQ_KEY = Deno.env.get('GROQ_API_KEY') ?? ''

/** At most this many in one run, whatever is waiting. */
const MOST = 12

/**
 * What the machine is told it is doing.
 *
 * Written as a standard rather than as a mood: "is this allowed on a game
 * platform children use" is a question a model answers differently every
 * time. The list is Kobblon's rules, and `unsure` is a real answer - a
 * machine that cannot say "I do not know" says something else instead, and
 * that something else is somebody's work being refused by a guess.
 */
const RULES = `You screen things people upload to Kobblon, a game platform used by children.

Answer with JSON only: {"decision":"approved"|"rejected"|"unsure","reason":"one short sentence"}

Reject if it has any of: nudity or sexual content; gore or realistic violence; slurs or hate; harassment of a named person; drugs, alcohol or gambling; real-world extremism or terrorism; anything sexualising children; scams, "free Brix" offers, or links to other sites; impersonation of Kobblon or its staff.

Approve ordinary game things: clothing, hats, faces, weapons that are obviously toys, blocky characters, logos somebody made, silly words, mild rudeness that a ten-year-old would say.

Say "unsure" when you genuinely cannot tell from what you were given. Do not guess. A person will look at anything you are unsure about.

The reason is shown to the person who made it, so write it plainly and without blaming them.`

/** One ask of Groq, with a picture when there is one. */
async function askGroq(
  model: string,
  words: string,
  picture: string | null,
): Promise<{ decision: string; reason: string } | null> {
  const content: unknown = picture
    ? [
      { type: 'text', text: words },
      { type: 'image_url', image_url: { url: picture } },
    ]
    : words

  const said = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${GROQ_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: RULES },
        { role: 'user', content },
      ],
    }),
  }).catch(() => null)

  if (!said || !said.ok) return null

  const body = await said.json().catch(() => null)
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return null

  try {
    const verdict = JSON.parse(text)
    const decision = String(verdict.decision ?? '').toLowerCase()
    if (!['approved', 'rejected', 'unsure'].includes(decision)) return null
    return { decision, reason: String(verdict.reason ?? '').slice(0, 300) }
  } catch {
    // A model that did not answer in the shape it was asked for is a model
    // that has not answered. Nothing is decided on a half-read reply.
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return answer({ error: 'Use POST.' }, 405)

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return answer({ error: 'This function is not configured.' }, 500)
  }
  if (!GROQ_KEY) {
    /*
     * Said plainly rather than failing oddly: without a key there is no
     * machine, and the console shows this sentence so somebody knows the
     * reason is a missing secret and not a broken queue.
     */
    return answer({ error: 'No GROQ_API_KEY is set, so nothing was screened.' }, 503)
  }

  /*
   * Who is asking. The service role may ask on its own; anybody else has to
   * be a signed-in admin, which is checked against the database rather than
   * taken from the request.
   */
  const sent = request.headers.get('authorization') ?? ''
  const token = sent.replace(/^Bearer\s+/i, '')
  const isWorker = token === SERVICE_KEY

  if (!isWorker) {
    const asking = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { authorization: sent } },
    })
    const { data: who } = await asking.auth.getUser()
    if (!who?.user) return answer({ error: 'Sign in first.' }, 401)
    const { data: profile } = await asking
      .from('profiles').select('is_admin').eq('id', who.user.id).maybeSingle()
    if (!profile?.is_admin) return answer({ error: 'Only Kobblon runs this.' }, 403)
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  const { data: settings } = await db.from('ai_settings').select('*').maybeSingle()
  if (!settings?.is_on) return answer({ error: 'AI moderation is off.' }, 409)

  const { data: work, error } = await db.rpc('ai_work', { how_many: MOST })
  if (error) return answer({ error: error.message }, 500)
  if (!work?.length) return answer({ looked: 0, decided: 0, note: 'Nothing waiting.' })

  let decided = 0
  let unsure = 0

  for (const job of work as {
    subject: string; subject_id: string; kind: string; name: string
    words: string; picture: string | null
  }[]) {
    /*
     * The picture, where there is one, as a plain public address. Both
     * buckets a screened thing can be in are public, so nothing is signed
     * and nothing private is handed to anybody.
     */
    const bucket = job.subject === 'asset' ? 'previews' : 'catalog'
    const picture = job.picture
      ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${job.picture}`
      : null

    const words = [
      `Kind: ${job.kind}`,
      `Name: ${job.name}`,
      job.words ? `Description: ${job.words}` : null,
      picture ? 'A picture of it is attached.' : 'There is no picture.',
    ].filter(Boolean).join('\n')

    const verdict = await askGroq(
      picture ? settings.vision_model : settings.model,
      words,
      picture,
    )

    // No answer at all leaves it exactly where it was, for a person.
    if (!verdict) continue

    if (verdict.decision === 'unsure') {
      unsure += 1
      await db.rpc('apply_ai_verdict', {
        subject: job.subject,
        subject_id: job.subject_id,
        decision: 'unsure',
        reason: verdict.reason,
        model: picture ? settings.vision_model : settings.model,
        looked_at: words,
      })
      continue
    }

    const { error: refused } = await db.rpc('apply_ai_verdict', {
      subject: job.subject,
      subject_id: job.subject_id,
      decision: verdict.decision,
      reason: verdict.reason,
      model: picture ? settings.vision_model : settings.model,
      looked_at: words,
    })
    if (!refused) decided += 1
  }

  return answer({ looked: work.length, decided, unsure })
})
