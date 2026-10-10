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
  /*
   * Listed by hand, this is a trap, and it cost a day.
   *
   * supabase-js puts `x-client-info` on every call it makes, and newer
   * versions add `x-supabase-api-version`. A browser asks the preflight
   * whether it may send each one, and a header missing from this list
   * means the browser cancels the request before it is sent — which the
   * library then reports as "Failed to send a request to the Edge
   * Function", the same sentence it uses when a function does not exist.
   * `login` happened to list `x-client-info` and worked; this one did not
   * and did not, and the two looked identical from outside.
   *
   * So the preflight echoes back whatever was asked for rather than
   * keeping a list in step with a library. That is not a hole: a header
   * is not a credential, every request still has to get past the checks
   * below, and a caller who can set headers can set them anyway — CORS
   * decides what a *page in a browser* may read, not who may call.
   */
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

/**
 * What the machine is told when it is reading something somebody said.
 *
 * This is a different job from screening an upload and it was being done
 * with the same prompt, which is why chat moderation has never worked:
 * `RULES` above asks for `approved` or `rejected`, and
 * `apply_ai_verdict` does nothing with either of those for a message. Every
 * line anybody has ever typed was read, answered, and dropped.
 *
 * Staw described the shape this should have: "kobby will not look at
 * individual words but look at the sentences we send, and then looks at the
 * rule again, and wonders if the sentence breaks the rules, if it doesnt
 * then kobby leaves it alone". So the rules arrive numbered, out of
 * `moderation_rules` rather than written here, and the answer has to name
 * one by its code. A model cannot be asked to be fair in general; it can be
 * asked whether this sentence breaks that rule.
 *
 * It is never asked what should happen. Gravity and the person's behaviour
 * bar decide that in `judge_chat_line`, where it cannot be argued with.
 */
function chatPrompt(rules: { ord: number; code: string; title: string; body: string }[]) {
  const list = rules
    .map((r) => `${r.ord}. [${r.code}] ${r.title}\n   ${r.body}`)
    .join('\n')

  return `You read single lines of chat on Kobblon, a game platform used by children, and decide whether the line breaks one of Kobblon's rules.

THE RULES

${list}

HOW TO DECIDE

Read the whole line and work out what it means to the person it was sent to. Then take each rule in turn and ask whether what the line means breaks that rule. Judge the meaning, never the individual words: an innuendo everybody present understands breaks a rule even with no rude word in it, and a rude word in an ordinary sentence breaks nothing. Lines arrive already filtered, so bullets (••••) are where a word was starred out.

If no rule is broken, say so. That is the usual answer and it is not a failure.

Answer with JSON only:
{"breaks": true|false, "rule": "<the code in brackets, or null>", "quote": "<the part of the line that breaks it, copied exactly, or null>", "reason": "<one short sentence, addressed to nobody, saying what the line does>"}

The reason is shown to the person who wrote the line. Write it plainly, say what the line did rather than what they are, and do not threaten them.`
}

/**
 * One ask of Groq, with a picture when there is one.
 *
 * It says why it failed rather than returning a bare null. Not for the
 * person who uploaded anything — for whoever pressed the button in the
 * staff console, because "looked: 12, decided: 0" is the same answer
 * whether the key is wrong, the model name is retired, or every single
 * thing in the queue was genuinely unclear. Those need different fixes and
 * the console could not tell them apart. Groq retires model names on its
 * own schedule, so a name that worked last month answering 404 today is the
 * ordinary case rather than the strange one.
 */
async function askGroq(
  model: string,
  words: string,
  picture: string | null,
): Promise<{ decision: string; reason: string } | { trouble: string }> {
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
  }).catch((why) => ({ failed: String(why) }) as const)

  if ('failed' in said) return { trouble: `Groq could not be reached: ${said.failed}` }

  if (!said.ok) {
    // Groq's own words, trimmed. A retired model name, a key that is not a
    // key, and a rate limit all land here and all read differently.
    const why = await said.text().catch(() => '')
    return { trouble: `Groq said ${said.status} for ${model}: ${why.slice(0, 300)}` }
  }

  const body = await said.json().catch(() => null)
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return { trouble: `${model} answered with no text.` }

  try {
    const verdict = JSON.parse(text)
    const decision = String(verdict.decision ?? '').toLowerCase()
    if (!['approved', 'rejected', 'unsure'].includes(decision)) {
      return { trouble: `${model} answered "${decision.slice(0, 40)}", which is not a decision.` }
    }
    return { decision, reason: String(verdict.reason ?? '').slice(0, 300) }
  } catch {
    // A model that did not answer in the shape it was asked for is a model
    // that has not answered. Nothing is decided on a half-read reply.
    return { trouble: `${model} did not answer in JSON.` }
  }
}

/**
 * What the machine is told when it is reading a report somebody sent.
 *
 * A different question again, and it was being asked the upload one. A
 * report is not content to approve or reject: it is somebody saying
 * another person did something, and the question is whether what they
 * describe is against a rule.
 *
 * It is not asked what should happen, for the same reason as the chat
 * prompt. `judge_report` takes the rule's gravity and the reported
 * person's behaviour bar and picks the rung, and the ceiling on that rung
 * is in `take_report`, where the machine has never been allowed to
 * terminate an account.
 *
 * `founded: false` is the ordinary answer to a report about nothing, and
 * saying so settles the ticket. A report the model cannot judge is left
 * open for a person by naming no rule at all.
 */
function reportPrompt(rules: { ord: number; code: string; title: string; body: string }[]) {
  const list = rules
    .map((r) => `${r.ord}. [${r.code}] ${r.title}\n   ${r.body}`)
    .join('\n')

  return `You read reports people send on Kobblon, a game platform used by children, and decide whether what the report describes breaks one of Kobblon's rules.

THE RULES

${list}

HOW TO DECIDE

You are given what was reported and what the reporter wrote. Work out what they are describing, then take each rule in turn and ask whether what is described breaks it. Judge what is described, not how angrily it is written: a calm report can be about something serious and a furious one can be about nothing.

Say founded false when the report describes something that is allowed, something too vague to tell, or a disagreement rather than a rule being broken. That is a common and correct answer.

If you cannot tell which rule it is about, name no rule. A person will read it.

Answer with JSON only:
{"founded": true|false, "rule": "<the code in brackets, or null>", "reason": "<one short sentence saying what is or is not against the rules>"}`
}

/** One ask about one report, against the numbered rules. */
async function askGroqReport(model: string, rules: {
  ord: number; code: string; title: string; body: string
}[], ticket: string): Promise<
  { founded: boolean; rule: string | null; reason: string } | { trouble: string }
> {
  const said = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${GROQ_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 250,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: reportPrompt(rules) },
        { role: 'user', content: ticket },
      ],
    }),
  }).catch((why) => ({ failed: String(why) }) as const)

  if ('failed' in said) return { trouble: `Groq could not be reached: ${said.failed}` }
  if (!said.ok) {
    const why = await said.text().catch(() => '')
    return { trouble: `Groq said ${said.status} for ${model}: ${why.slice(0, 300)}` }
  }

  const body = await said.json().catch(() => null)
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return { trouble: `${model} answered with no text.` }

  try {
    const verdict = JSON.parse(text)
    return {
      founded: verdict.founded === true,
      rule: typeof verdict.rule === 'string' && verdict.rule.trim() ? verdict.rule.trim() : null,
      reason: String(verdict.reason ?? '').slice(0, 300),
    }
  } catch {
    return { trouble: `${model} did not answer in JSON.` }
  }
}

/** One ask about one line, against the numbered rules. */
async function askGroqChat(model: string, rules: {
  ord: number; code: string; title: string; body: string
}[], line: string): Promise<
  { breaks: boolean; rule: string | null; quote: string | null; reason: string }
  | { trouble: string }
> {
  const said = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${GROQ_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 250,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: chatPrompt(rules) },
        { role: 'user', content: line },
      ],
    }),
  }).catch((why) => ({ failed: String(why) }) as const)

  if ('failed' in said) return { trouble: `Groq could not be reached: ${said.failed}` }
  if (!said.ok) {
    const why = await said.text().catch(() => '')
    return { trouble: `Groq said ${said.status} for ${model}: ${why.slice(0, 300)}` }
  }

  const body = await said.json().catch(() => null)
  const text = body?.choices?.[0]?.message?.content
  if (typeof text !== 'string') return { trouble: `${model} answered with no text.` }

  try {
    const verdict = JSON.parse(text)
    const breaks = verdict.breaks === true
    /*
     * A code that is not on the list it was given is not a refusal to
     * answer - `judge_chat_line` records it as unsure and does nothing,
     * which is the right amount of nothing. It is passed through rather
     * than corrected here so the console can see the model drifting off
     * its own list.
     */
    const rule = breaks && typeof verdict.rule === 'string' ? verdict.rule.trim() : null
    return {
      breaks: breaks && Boolean(rule),
      rule,
      quote: typeof verdict.quote === 'string' ? verdict.quote.slice(0, 500) : null,
      reason: String(verdict.reason ?? '').slice(0, 300),
    }
  } catch {
    return { trouble: `${model} did not answer in JSON.` }
  }
}

/**
 * Which models this key can actually use, asked of Groq rather than
 * remembered.
 *
 * Groq retires names on its own schedule — `llama-3.3-70b-versatile` went
 * on 16 August 2026 and the vision previews before it — and a name written
 * down in a migration is a name that is right until it is not, with
 * "decided 0" as the only symptom. So the console asks, and whoever is
 * setting this picks from what exists today.
 */
async function groqModels(): Promise<{ models?: string[]; trouble?: string }> {
  const said = await fetch('https://api.groq.com/openai/v1/models', {
    headers: { authorization: `Bearer ${GROQ_KEY}` },
  }).catch((why) => ({ failed: String(why) }) as const)

  if ('failed' in said) return { trouble: `Groq could not be reached: ${said.failed}` }
  if (!said.ok) {
    const why = await said.text().catch(() => '')
    return { trouble: `Groq said ${said.status}: ${why.slice(0, 300)}` }
  }

  const body = await said.json().catch(() => null)
  const list = Array.isArray(body?.data) ? body.data : []
  const models = list
    .map((one: { id?: unknown }) => String(one?.id ?? ''))
    .filter((id: string) => id && !/whisper|tts|guard/i.test(id))
    .sort()
  return { models }
}

/*
 * Anything thrown anywhere in here comes back as an answer with the CORS
 * headers on it.
 *
 * This is not tidiness. A handler that throws gets a 500 from the runtime
 * with no `Access-Control-Allow-Origin` on it, and a browser will not let
 * the page read a response without that header - so the one thing it can
 * say is "the request failed", which is the same sentence it says when the
 * function is not deployed, when the gateway refused the preflight, and
 * when the machine is on fire. Three different faults, one useless
 * message, and no way to tell them apart from the outside. Caught here,
 * the page can read what actually happened.
 */
Deno.serve(async (request) => {
  try {
    return await handle(request)
  } catch (why) {
    return answer({ error: `The worker fell over: ${String(why)}` }, 500)
  }
})

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...CORS,
        'Access-Control-Allow-Headers':
          request.headers.get('access-control-request-headers')
          ?? CORS['Access-Control-Allow-Headers'],
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  /*
   * A ping answers before anything else: before the method check, before
   * the sign-in check, and without touching the database, Groq, or who is
   * asking. It is how you find out whether the function is reachable at
   * all, which is the question underneath every "failed to send a
   * request" — and it has to be answerable by a plain address in a browser
   * tab, because that is the one way of asking that no library, session or
   * preflight can get in the way of.
   *
   * It says nothing an outsider does not already know: that there is a
   * function here. Whether the two keys are set is all it adds, as
   * booleans about the server's own configuration rather than anything
   * about anybody's account.
   */
  if (new URL(request.url).searchParams.has('ping')) {
    return answer({
      alive: true,
      hasGroqKey: Boolean(GROQ_KEY),
      hasServiceKey: Boolean(SERVICE_KEY),
      hasAnonKey: Boolean(ANON_KEY),
    })
  }

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

  /*
   * The database client is made first, because validating a token needs
   * one and the service role is the thing that can do it.
   */
  const db = createClient(SUPABASE_URL, SERVICE_KEY)

  if (!isWorker) {
    /*
     * Checked with the service role, the way `discord` has always done it,
     * and not with an anon client.
     *
     * The anon version depended on `SUPABASE_ANON_KEY` being set and on
     * legacy keys still being enabled on the project — neither of which is
     * true everywhere, and both of which fail as "no user", which reads to
     * whoever pressed the button as "you are not signed in" while they are
     * looking at their own name in the corner. The service role validates
     * the token itself and needs nothing from the caller but the token.
     *
     * This grants nothing extra. The token still has to be a real one, and
     * `is_admin` is still read from the database rather than believed from
     * the request.
     */
    const { data: who, error: badToken } = await db.auth.getUser(token)
    if (badToken || !who?.user) {
      return answer({
        error: !token
          ? 'No sign-in was sent with that. Sign out and back in, then try again.'
          : `That sign-in was not accepted: ${badToken?.message ?? 'no account behind it'}.`,
      }, 401)
    }

    const { data: profile, error: noProfile } = await db
      .from('profiles').select('is_admin').eq('id', who.user.id).maybeSingle()
    if (noProfile) return answer({ error: `Your account could not be read: ${noProfile.message}` }, 500)
    if (!profile?.is_admin) return answer({ error: 'Only Kobblon runs this.' }, 403)
  }

  /*
   * Asking what the machine *could* be, rather than setting it going. Same
   * door, same two ways through it: this hands back model names, which is
   * not public information about somebody's account.
   */
  const asked = await request.json().catch(() => ({}))
  if (asked?.ping) {
    return answer({ alive: true, hasGroqKey: Boolean(GROQ_KEY), hasServiceKey: Boolean(SERVICE_KEY) })
  }
  if (asked?.list) {
    const { models, trouble } = await groqModels()
    return trouble ? answer({ error: trouble }, 502) : answer({ models })
  }

  const { data: settings } = await db.from('ai_settings').select('*').maybeSingle()
  if (!settings?.is_on) return answer({ error: 'AI moderation is off.' }, 409)

  const { data: work, error } = await db.rpc('ai_work', { how_many: MOST })
  if (error) return answer({ error: error.message }, 500)
  if (!work?.length) return answer({ looked: 0, decided: 0, note: 'Nothing waiting.' })

  /*
   * The rules, read out of the database rather than carried here.
   *
   * Fetched once per run, not once per line: the list changes when
   * somebody edits a row, which is not twelve times a minute. If it cannot
   * be read, nothing somebody said is judged at all this run - a model
   * asked to judge against a list it was not given will answer anyway, and
   * that answer is a guess with a sanction on the end of it.
   */
  const { data: ruleRows, error: noRules } = await db.rpc('the_rules', { channel: 'chat' })
  const rules = (ruleRows ?? []) as {
    ord: number; code: string; title: string; body: string; gravity: number
  }[]

  let decided = 0
  let unsure = 0
  /* What was actually done to anybody, by rung, so the console can say so. */
  const acted: Record<string, number> = {}
  /*
   * Every distinct reason the machine failed, once each. Twelve jobs
   * failing the same way is one fault, and a list of twelve identical
   * sentences is how a console stops being read.
   */
  const trouble = new Set<string>()

  for (const job of work as {
    subject: string; subject_id: string; kind: string; name: string
    words: string; picture: string | null
  }[]) {
    /*
     * A line somebody said goes down its own path: its own prompt, the
     * numbered rules, and `judge_chat_line` rather than
     * `apply_ai_verdict`. What happens to the person is not decided here
     * and is not in the model's answer - the rule's gravity and their
     * behaviour bar decide it in the database.
     */
    if (job.subject === 'message') {
      if (noRules || !rules.length) {
        trouble.add(
          noRules
            ? `The rules could not be read, so nothing anybody said was judged: ${noRules.message}`
            : 'No rules are switched on, so nothing anybody said was judged.',
        )
        continue
      }

      const verdict = await askGroqChat(settings.model, rules, job.words)
      if ('trouble' in verdict) {
        trouble.add(verdict.trouble)
        continue
      }

      const { data: did, error: refusedLine } = await db.rpc('judge_chat_line', {
        line_id: Number(job.subject_id),
        breaks: verdict.breaks,
        rule_code: verdict.rule,
        quote: verdict.quote,
        reason: verdict.reason,
        model: settings.model,
      })
      if (refusedLine) {
        trouble.add(`A line could not be judged: ${refusedLine.message}`)
        continue
      }

      decided += 1
      if (typeof did === 'string' && did !== 'nothing') {
        acted[did] = (acted[did] ?? 0) + 1
      }
      continue
    }

    /*
     * A report. `judge_report` settles it through `take_report`, which is
     * the one door onto a report and the one place the machine's ceiling
     * lives - it may warn, quiet and suspend, and it is refused outright
     * if it ever asks for a termination.
     *
     * Until this branch existed, `ai_work` handed the machine reports it
     * had no way to finish: it answered in the vocabulary of screening an
     * upload, nothing matched, and the ticket stayed open.
     */
    if (job.subject === 'report') {
      if (noRules || !rules.length) {
        trouble.add(
          noRules
            ? `The rules could not be read, so no report was judged: ${noRules.message}`
            : 'No rules are switched on, so no report was judged.',
        )
        continue
      }

      const ticket = [
        `What was reported: ${job.kind}`,
        `The thing reported: ${job.name}`,
        job.words ? `What the reporter wrote: ${job.words}` : 'The reporter wrote nothing.',
      ].join('\n')

      const verdict = await askGroqReport(settings.model, rules, ticket)
      if ('trouble' in verdict) {
        trouble.add(verdict.trouble)
        continue
      }

      const { data: did, error: refusedReport } = await db.rpc('judge_report', {
        ticket: Number(job.subject_id),
        founded: verdict.founded,
        rule_code: verdict.rule,
        why: verdict.reason,
        model: settings.model,
      })
      if (refusedReport) {
        trouble.add(`A report could not be judged: ${refusedReport.message}`)
        continue
      }

      if (did === 'unsure') {
        unsure += 1
        continue
      }
      decided += 1
      if (typeof did === 'string' && did !== 'nothing') {
        acted[did] = (acted[did] ?? 0) + 1
      }
      continue
    }

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

    /*
     * No vision model set means no machine looks at pictures, and the thing
     * is left exactly where it was, for a person. That is a real setting
     * rather than a broken one: Groq's catalogue has had no vision model
     * for stretches at a time, and sending a picture to a model that
     * cannot see is twelve refusals that mean nothing.
     */
    if (picture && !settings.vision_model) {
      trouble.add('No vision model is set, so anything with a picture was left for a person.')
      continue
    }

    const verdict = await askGroq(
      picture ? settings.vision_model : settings.model,
      words,
      picture,
    )

    // No answer at all leaves it exactly where it was, for a person.
    if ('trouble' in verdict) {
      trouble.add(verdict.trouble)
      continue
    }

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

  return answer({
    looked: work.length,
    decided,
    unsure,
    acted: Object.keys(acted).length ? acted : undefined,
    trouble: trouble.size ? [...trouble] : undefined,
  })
}
