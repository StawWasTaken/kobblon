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
   * means the browser cancels the request before it is sent - which the
   * library then reports as "Failed to send a request to the Edge
   * Function", the same sentence it uses when a function does not exist.
   * `login` happened to list `x-client-info` and worked; this one did not
   * and did not, and the two looked identical from outside.
   *
   * So the preflight echoes back whatever was asked for rather than
   * keeping a list in step with a library. That is not a hole: a header
   * is not a credential, every request still has to get past the checks
   * below, and a caller who can set headers can set them anyway - CORS
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
 * The same rules, asked about a name rather than a line of chat.
 *
 * A separate prompt because the two readings are genuinely different. A
 * handle is not a sentence: it has no context, no person it was said to and
 * no punctuation, and the evasion in it is spelling - `f_u_c_k`, `n1gg4`,
 * letters stretched out. And it is on every page the person appears on, so
 * an innuendo that would be a shrug in chat is not one here. The other way
 * too: a short string that merely looks like something is a false positive
 * waiting to happen, and a handle with an innocent reading has one.
 */
function namePrompt(rules: { ord: number; code: string; title: string; body: string }[], field: string) {
  const list = rules
    .map((r) => `${r.ord}. [${r.code}] ${r.title}\n   ${r.body}`)
    .join('\n')

  const where = field === 'bio'
    ? 'the few lines somebody wrote about themselves on their profile'
    : field === 'display_name'
      ? 'the name somebody chose to be shown under, which appears beside everything they do'
      : 'somebody\'s handle, the @name on their profile and in every chat they speak in'

  return `You read ${where} on Kobblon, a game platform used by children, and decide whether it breaks one of Kobblon's rules.

THE RULES

${list}

HOW TO READ IT

Work out what it says, including when it is spelled out, stretched out or written with digits for letters: f_u_c_k, n1gg3r and x-x-x are the words they are, and a name chosen to read as a slur breaks the hate rule however it is spelled. Judge what it says and not how it is spelled otherwise.

Then be careful the other way. A name is short and a short string can look like anything; if it has an ordinary reading, that is the reading. Real words that contain rude ones inside them (class, grass, assassin, Scunthorpe) break nothing. A gamer handle is allowed to be silly, violent-sounding in the way a game is, or made of nonsense. Being odd is not breaking a rule, and nor is being rude about nobody in particular unless a rule says it is.

If no rule is broken, say so. That is the usual answer and it is not a failure.

Answer with JSON only:
{"breaks": true|false, "rule": "<the code in brackets, or null>", "reason": "<one short sentence saying what it says>"}

The reason is shown to the person who chose it. Say what the name does rather than what they are, and do not threaten them.`
}

/**
 * One ask of Groq, with a picture when there is one.
 *
 * It says why it failed rather than returning a bare null. Not for the
 * person who uploaded anything - for whoever pressed the button in the
 * staff console, because "looked: 12, decided: 0" is the same answer
 * whether the key is wrong, the model name is retired, or every single
 * thing in the queue was genuinely unclear. Those need different fixes and
 * the console could not tell them apart. Groq retires model names on its
 * own schedule, so a name that worked last month answering 404 today is the
 * ordinary case rather than the strange one.
 */
/*
 * One way out to Groq, for every ask.
 *
 * Two things the first live run found, inside one minute of real traffic:
 *
 *   * **429.** `openai/gpt-oss-20b` has eight thousand tokens a minute on
 *     the free tier, and twelve jobs is more than that. Groq says how long
 *     to wait in its own sentence, so that is read and waited out once. A
 *     second 429 means the minute is genuinely spent: the run stops there
 *     and says so, rather than grinding through the rest of the queue
 *     collecting the same refusal nine more times. What is left is still
 *     waiting, and the next run takes it.
 *   * **400 `json_validate_failed`.** Asking that model for
 *     `response_format: json_object` fails outright on some lines - Groq's
 *     own words are "Failed to validate JSON. Please adjust your prompt".
 *     Asked again without the flag it answers JSON anyway, because every
 *     prompt here already says to, and the reply is read with `firstJson`
 *     since a model left to itself sometimes wraps it in a sentence.
 */
const sleep = (ms: number) => new Promise((go) => setTimeout(go, ms))

/**
 * Whether the minute is spent, for this run.
 *
 * Module-level because every ask shares it and the run loop reads it, and
 * cleared at the top of every run because an edge function's isolate is
 * reused between calls: a flag left standing would stop the next run
 * before it began.
 */
let limitSpent = false

/** How long Groq said to wait, out of its own sentence. Capped at 20s. */
function waitFromGroq(said: string): number {
  const found = said.match(/try again in ([\d.]+)s/i)
  const seconds = found ? Number(found[1]) : NaN
  if (!Number.isFinite(seconds)) return 2000
  return Math.min(Math.ceil(seconds * 1000) + 250, 20_000)
}

/** The first `{...}` in a reply, for a model that wrapped it in words. */
function firstJson(text: string): Record<string, unknown> | null {
  const from = text.indexOf('{')
  const to = text.lastIndexOf('}')
  if (from < 0 || to <= from) return null
  try {
    return JSON.parse(text.slice(from, to + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

async function postToGroq(
  body: Record<string, unknown>,
): Promise<{ text: string } | { trouble: string }> {
  const model = String(body.model ?? '')
  let waited = false
  let plain = false

  for (;;) {
    const said = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${GROQ_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch((why) => ({ failed: String(why) }) as const)

    if ('failed' in said) return { trouble: `Groq could not be reached: ${said.failed}` }

    if (said.ok) {
      const answer = await said.json().catch(() => null)
      const text = answer?.choices?.[0]?.message?.content
      if (typeof text !== 'string') return { trouble: `${model} answered with no text.` }
      return { text }
    }

    const why = await said.text().catch(() => '')

    if (said.status === 429 && !waited) {
      waited = true
      await sleep(waitFromGroq(why))
      continue
    }
    if (said.status === 429) {
      limitSpent = true
      return {
        trouble:
          `Groq's limit for ${model} is spent for this minute, so the run stopped `
          + 'there. What is left is still waiting, and the next run takes it.',
      }
    }

    if (said.status === 400 && why.includes('json_validate_failed') && !plain) {
      plain = true
      delete body.response_format
      continue
    }

    // Groq's own words, trimmed. A retired model name, a key that is not a
    // key, and a rate limit all land here and all read differently.
    return { trouble: `Groq said ${said.status} for ${model}: ${why.slice(0, 300)}` }
  }
}

/**
 * A rule code as the model wrote it, spelt as the database spells it.
 *
 * The prompts number the rules and put each code in brackets, so a model
 * answering `[sexual]` has copied what it was shown rather than got it
 * wrong - and `judge_report` then said "Named a rule that does not exist:
 * [sexual]" and left a real report unsure. The brackets, quotes and case
 * come off here, the one place that knows both how the prompt is written
 * and how the column is spelt.
 */
function tidyRule(said: unknown): string | null {
  if (typeof said !== 'string') return null
  const word = said.trim().replace(/^[\[("'`]+/, '').replace(/[\])"'`.]+$/, '').trim().toLowerCase()
  return word && word !== 'null' ? word : null
}

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

  const said = await postToGroq({
    model,
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: RULES },
      { role: 'user', content },
    ],
  })
  if ('trouble' in said) return said
  const text = said.text

  try {
    const verdict = firstJson(text) ?? JSON.parse(text)
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


/* ------------------------------------------------- answering a support ticket */

const TICKET_PROMPT = `You answer support tickets for Kobblon, a game platform used by children. You are writing as Kobblon, not as a named person.

HOW TO ANSWER

Read what they wrote and answer the question they actually asked, in plain words, in at most four sentences. No greeting block, no sign-off, no "I'm sorry to hear that". Say what is true, say what they should do next, and stop.

Set confident false - and leave the answer empty - whenever any of these is true:

* you would have to guess at something about their account, their money, or a specific thing they uploaded
* answering would mean promising a refund, a reversal, a restoration or an exception
* it is about a decision taken against their account, which is appealed and not answered here
* it is a report about another person, which is handled somewhere else
* you simply do not know

A person reads every ticket you are not confident about, so saying nothing costs them a short wait and saying the wrong thing costs them their trust. Prefer the wait.

Never ask for a password. Never claim an action has been taken. Never invent a policy, a price, a date or a feature.

Answer with JSON only:
{"confident": true|false, "reply": "<the answer, or an empty string>"}`

/** One ask about one support ticket. */
async function askGroqTicket(model: string, ticket: string): Promise<
  { confident: boolean; reply: string } | { trouble: string }
> {
  const got = await askGroqJson(model, TICKET_PROMPT, ticket, 400)
  if ('trouble' in got) return got
  return {
    confident: got.json.confident === true,
    reply: String(got.json.reply ?? '').slice(0, 2000),
  }
}

/* --------------------------------------------------------- deciding an appeal */

function appealPrompt(rules: { ord: number; code: string; title: string; body: string }[]) {
  const list = rules.map((r) => `${r.ord}. [${r.code}] ${r.title}\n   ${r.body}`).join('\n')

  return `You look again at a moderation decision Kobblon's own machine made, now that the person has appealed it. Kobblon is a game platform used by children.

THE RULES

${list}

HOW TO DECIDE

You are given the decision, the reason recorded for it, the evidence kept with it, and what the person says. Ask one question: does the evidence actually break the rule that was named?

Overturn when the evidence does not show the rule being broken, when the rule named does not fit what was said, or when it is genuinely ambiguous. An ambiguous case is overturned: the cost of lifting a warning that was fair is far smaller than the cost of holding one that was not.

Uphold only when the evidence plainly breaks the rule and what the person says does not change that. "I did not mean it that way" can change it. "Everyone else does it" does not.

Write the reason as something the person will read about their own account: short, plain, and about what was said rather than about them.

Answer with JSON only:
{"overturn": true|false, "reason": "<one or two short sentences>"}`
}

/** One ask about one appeal, against the numbered rules. */
async function askGroqAppeal(model: string, rules: {
  ord: number; code: string; title: string; body: string
}[], appeal: string): Promise<
  { overturn: boolean; reason: string } | { trouble: string }
> {
  const got = await askGroqJson(model, appealPrompt(rules), appeal, 300)
  if ('trouble' in got) return got
  return {
    overturn: got.json.overturn === true,
    reason: String(got.json.reason ?? '').slice(0, 500),
  }
}

/**
 * The one ask, for the two above.
 *
 * `askGroqReport` and `askGroqChat` predate this and each carry their own
 * copy of it. They are left alone deliberately: they are the two paths that
 * take action against an account, they are checked, and rewriting them to
 * share a helper is a change to working moderation code for tidiness.
 */
async function askGroqJson(
  model: string, system: string, words: string, limit: number,
): Promise<{ json: Record<string, unknown> } | { trouble: string }> {
  const said = await postToGroq({
    model,
    temperature: 0,
    max_tokens: limit,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: words },
    ],
  })
  if ('trouble' in said) return said
  const text = said.text

  try {
    return { json: firstJson(text) ?? JSON.parse(text) }
  } catch {
    return { trouble: `${model} did not answer in JSON.` }
  }
}

/** One ask about one report, against the numbered rules. */
async function askGroqReport(model: string, rules: {
  ord: number; code: string; title: string; body: string
}[], ticket: string): Promise<
  { founded: boolean; rule: string | null; reason: string } | { trouble: string }
> {
  const said = await postToGroq({
    model,
    temperature: 0,
    max_tokens: 250,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: reportPrompt(rules) },
      { role: 'user', content: ticket },
    ],
  })
  if ('trouble' in said) return said
  const text = said.text

  try {
    const verdict = firstJson(text) ?? JSON.parse(text)
    return {
      founded: verdict.founded === true,
      rule: tidyRule(verdict.rule),
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
  const said = await postToGroq({
    model,
    temperature: 0,
    max_tokens: 250,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: chatPrompt(rules) },
      { role: 'user', content: line },
    ],
  })
  if ('trouble' in said) return said
  const text = said.text

  try {
    const verdict = firstJson(text) ?? JSON.parse(text)
    const breaks = verdict.breaks === true
    /*
     * A code that is not on the list it was given is not a refusal to
     * answer - `judge_chat_line` records it as unsure and does nothing,
     * which is the right amount of nothing. It is passed through rather
     * than corrected here so the console can see the model drifting off
     * its own list.
     */
    const rule = breaks ? tidyRule(verdict.rule) : null
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

async function askGroqName(model: string, rules: {
  ord: number; code: string; title: string; body: string
}[], field: string, text: string): Promise<
  { breaks: boolean; rule: string | null; reason: string } | { trouble: string }
> {
  const said = await postToGroq({
    model,
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: namePrompt(rules, field) },
      { role: 'user', content: text },
    ],
  })
  if ('trouble' in said) return said

  try {
    const verdict = firstJson(said.text) ?? JSON.parse(said.text)
    const breaks = verdict.breaks === true
    const rule = breaks ? tidyRule(verdict.rule) : null
    return {
      breaks: breaks && Boolean(rule),
      rule,
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
 * Groq retires names on its own schedule - `llama-3.3-70b-versatile` went
 * on 16 August 2026 and the vision previews before it - and a name written
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


/**
 * The `role` a token claims, read without verifying it.
 *
 * Only ever used to write a better error. Nothing is trusted from it: the
 * one path that grants anything compares the whole token against the key
 * this function holds, and a signed-in person is still checked against the
 * database.
 */
function roleClaimOf(token: string): string | null {
  const middle = token.split('.')[1]
  if (!middle) return null
  try {
    const json = atob(middle.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json)
    return typeof claims?.role === 'string' ? claims.role : null
  } catch {
    return null
  }
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
   * request" - and it has to be answerable by a plain address in a browser
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
  /*
   * Trimmed, because a key pasted into a GitHub secret box carries a
   * trailing newline often enough to be worth one call: a key that is
   * right apart from a `\n` fails the comparison below and then fails
   * again as a sign-in, and the sentence it produces is about claims,
   * which sends whoever reads it looking at the wrong thing entirely.
   */
  const token = sent.replace(/^Bearer\s+/i, '').trim()
  const isWorker = Boolean(SERVICE_KEY) && token === SERVICE_KEY

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
     * legacy keys still being enabled on the project - neither of which is
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
      /*
       * Name the real fault when the caller is plainly a machine.
       *
       * A service-role key has a `role` claim and no `sub`, so when one is
       * sent that is *not* this project's key, it falls to here and
       * Supabase answers "missing sub claim" - which is true, and which
       * describes the shape of a service-role token rather than the thing
       * that is actually wrong, which is that the key does not match. That
       * sentence cost a round of looking at the gateway and at
       * `verify_jwt` before anybody looked at the key itself.
       *
       * The token is read, never echoed: only which role it claims, which
       * says nothing an attacker holding it does not have already.
       */
      const claimed = roleClaimOf(token)
      if (claimed === 'service_role' || claimed === 'anon') {
        return answer({
          error:
            `A ${claimed} key was sent, and it is not this project's `
            + 'service-role key. Check the key in the caller against '
            + 'Project Settings, API, service_role - they have to match '
            + 'exactly, with no newline on the end.',
        }, 401)
      }
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

  /*
   * Asking Kobby to draft a change to what the filter catches.
   *
   * Staw: "we can even ask kobby like we give it a sentence like something
   * to do and kobby will add banned words like for example i ask kobby
   * 'kobby, censor all the words about rape'".
   *
   * It drafts; it does not apply. That is the whole design and it is not
   * timidity: this list runs against every line anybody types, so a pattern
   * that is one bracket too wide refuses half the chat and the only way
   * anybody finds out is the people it wrongly silenced. The console shows
   * what it proposes, somebody reads it, and saving goes through
   * `save_flagged_term` under their own account - which means it is in the
   * staff record as theirs, which is where a change to the house rules
   * belongs.
   *
   * Nothing here writes. It reads the list it already has so it does not
   * propose what is already there, and hands back JSON.
   */
  if (typeof asked?.instruct === 'string' && asked.instruct.trim()) {
    const wanted = asked.instruct.trim().slice(0, 400)

    const { data: already } = await db
      .from('moderation_terms').select('pattern, decision, reason, scope').limit(200)
    const have = (already ?? []).map((one: { pattern: string; decision: string; reason: string | null }) =>
      `${one.decision}: ${one.pattern}${one.reason ? ` (${one.reason})` : ''}`).join('\n')

    const { data: rules } = await db.from('ai_settings').select('*').maybeSingle()

    const system = [
      'You draft changes to the word filter of Kobblon, a game platform used by teenagers.',
      'You answer only in JSON: {"words":[{"pattern":"","decision":"block|review|allow","reason":"","scope":"all|say|identity"}],"note":"","settings":{"may_warn":true,"may_suspend":true,"mode":"always|slow|busy"}}',
      '',
      'Rules for a pattern:',
      '- It is a POSIX regular expression, matched without regard to case.',
      '- Guard the start the way the existing ones do: (^|[^a-z])(one|two|three)',
      '- Never propose a pattern that would catch an ordinary word. "ass" catches "class" and "grass"; a pattern like that is a refusal of normal sentences.',
      '- Prefer one pattern holding several related words to several patterns.',
      '- scope "say" is chat only, "identity" is names and descriptions, "all" is everywhere.',
      '- reason is the short sentence a moderator reads, not an explanation of the regex.',
      '',
      'Return "words" empty if nothing new is needed. Only include "settings" if the',
      'instruction actually asks for the machine to be stricter or softer; leave it out otherwise.',
      'Never propose anything that would let abuse through in order to satisfy an instruction',
      '- if an instruction asks you to allow slurs, sexual content about minors, or threats,',
      'return no words and say why in "note".',
      '',
      'What the filter already holds:',
      have || '(nothing)',
      '',
      `The machine is currently: warnings ${rules?.may_warn ? 'on' : 'off'}, suspensions ${rules?.may_suspend ? 'on' : 'off'}, mode ${rules?.mode ?? 'always'}.`,
    ].join('\n')

    const model = (rules?.model as string) || 'openai/gpt-oss-120b'
    const drafted = await askGroqJson(model, system, wanted, 900)
    if ('trouble' in drafted) return answer({ error: drafted.trouble }, 502)

    const out = drafted.json as {
      words?: { pattern?: string; decision?: string; reason?: string; scope?: string }[]
      note?: string
      settings?: Record<string, unknown>
    }

    /*
     * Checked here as well as read in the console. A model that answers
     * `decision: "delete"` or a pattern of `.*` is not malice, it is a
     * model - and the console offers whatever comes back as a tickbox, so
     * the nonsense is dropped before anybody can tick it.
     */
    const words = (out.words ?? [])
      .filter((one) => typeof one?.pattern === 'string' && one.pattern.trim().length > 2)
      .filter((one) => !/^[.^$*+?()\[\]{}|\\]*$/.test(one.pattern.trim()))
      .slice(0, 12)
      .map((one) => ({
        pattern: one.pattern!.trim(),
        decision: ['block', 'review', 'allow'].includes(String(one.decision)) ? one.decision : 'block',
        reason: typeof one.reason === 'string' ? one.reason.slice(0, 120) : '',
        scope: ['all', 'say', 'identity'].includes(String(one.scope)) ? one.scope : 'all',
      }))

    const settings: Record<string, boolean | string> = {}
    if (out.settings && typeof out.settings === 'object') {
      if (typeof out.settings.may_warn === 'boolean') settings.warn = out.settings.may_warn
      if (typeof out.settings.may_suspend === 'boolean') settings.suspend = out.settings.may_suspend
      if (['always', 'slow', 'busy'].includes(String(out.settings.mode))) {
        settings.how = String(out.settings.mode)
      }
    }

    return answer({
      words,
      note: typeof out.note === 'string' ? out.note.slice(0, 400) : '',
      settings: Object.keys(settings).length ? settings : null,
    })
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

  /*
   * Cleared here rather than where it is declared: the isolate is reused
   * between calls, so a run that spent the minute would otherwise stop
   * the next one before it started.
   */
  limitSpent = false

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
     * The minute is spent. Everything still in `work` is still waiting -
     * nothing was marked read - so this is a pause, not a loss, and the
     * run says which it was.
     */
    if (limitSpent) break

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

      /*
       * A spoken line is told it was spoken.
       *
       * Not to judge it more harshly - the rules are the rules - but
       * because a transcript reads differently: no punctuation, run-on
       * words, and whatever the recogniser guessed. A model shown that as
       * if it were typed reads the recogniser's mistakes as the person's.
       */
      const heard = job.kind === 'voice'
        ? `Said out loud in voice chat and transcribed, so the wording may be imperfect: ${job.words}`
        : job.words

      const verdict = await askGroqChat(settings.model, rules, heard)
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
     * A handle, a display name or a bio. Judged against the same numbered
     * rules as a line of chat, and settled by `judge_profile_text`, which
     * takes the name away at every rung above nothing and decides the rung
     * itself. Nothing here says what happens to anybody.
     */
    if (job.subject === 'profile_text') {
      if (noRules || !rules.length) {
        trouble.add(
          noRules
            ? `The rules could not be read, so no name was judged: ${noRules.message}`
            : 'No rules are switched on, so no name was judged.',
        )
        continue
      }

      const verdict = await askGroqName(settings.model, rules, job.kind, job.words)
      if ('trouble' in verdict) {
        trouble.add(verdict.trouble)
        continue
      }

      const { data: did, error: refusedName } = await db.rpc('judge_profile_text', {
        entry: Number(job.subject_id),
        breaks: verdict.breaks,
        rule_code: verdict.rule,
        reason: verdict.reason,
        model: settings.model,
      })
      if (refusedName) {
        trouble.add(`A name could not be judged: ${refusedName.message}`)
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
     * A support ticket. The machine writes the reply as Kobblon; the
     * database decides whether it is allowed to, and it refuses outright
     * for anybody who ticked "I want a person".
     */
    if (job.subject === 'ticket') {
      const asked = [
        `What it is about: ${job.kind}`,
        `Subject: ${job.name}`,
        job.words ? `What they wrote: ${job.words}` : 'They wrote nothing beyond the subject.',
      ].join('\n')

      const draft = await askGroqTicket(settings.model, asked)
      if ('trouble' in draft) {
        trouble.add(draft.trouble)
        continue
      }

      const { data: did, error: refusedTicket } = await db.rpc('answer_ticket', {
        ticket: Number(job.subject_id),
        reply: draft.reply,
        confident: draft.confident,
        model: settings.model,
      })
      if (refusedTicket) {
        trouble.add(`A ticket could not be answered: ${refusedTicket.message}`)
        continue
      }

      if (did === 'answered') decided += 1
      else unsure += 1
      if (typeof did === 'string') acted[did] = (acted[did] ?? 0) + 1
      continue
    }

    /*
     * An appeal against one of the machine's own decisions. `ai_work` hands
     * over no other kind, and `judge_appeal` refuses the rest anyway - a
     * person's decision is a person's to revisit.
     */
    if (job.subject === 'appeal') {
      if (noRules || !rules.length) {
        trouble.add(
          noRules
            ? `The rules could not be read, so no appeal was decided: ${noRules.message}`
            : 'No rules are switched on, so no appeal was decided.',
        )
        continue
      }

      const asked = [
        `What was decided: ${job.kind}`,
        `The reason recorded: ${job.name}`,
        job.words ? `What they say: ${job.words}` : 'They said nothing.',
      ].join('\n')

      const second = await askGroqAppeal(settings.model, rules, asked)
      if ('trouble' in second) {
        trouble.add(second.trouble)
        continue
      }

      const { data: did, error: refusedAppeal } = await db.rpc('judge_appeal', {
        appeal: Number(job.subject_id),
        overturn: second.overturn,
        why: second.reason,
        model: settings.model,
      })
      if (refusedAppeal) {
        trouble.add(`An appeal could not be decided: ${refusedAppeal.message}`)
        continue
      }

      if (did === 'for_a_person' || did === 'gone') unsure += 1
      else decided += 1
      if (typeof did === 'string') acted[did] = (acted[did] ?? 0) + 1
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
