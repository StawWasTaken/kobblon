/*
 * Turning a one-time code into a session, for a Kobblon application.
 *
 * This is the only place that holds the service role, and it holds it because
 * what it returns decides who somebody is. The application never sees that
 * key: it sends a code it was handed through its protocol link and gets back
 * something it can exchange with Supabase Auth in the ordinary way.
 *
 * The code was minted by the website for a signed-in person, is good for two
 * minutes, and is spent by the first caller. Everything else about it is
 * enforced in the database rather than here.
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

/** What the application may send, and the only shapes accepted. */
const CODE = /^[A-Za-z0-9_-]{32,128}$/
const CLIENTS = new Set(['launcher', 'creator'])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return answer({ error: 'Use POST.' }, 405)

  let sent: { code?: unknown; client?: unknown }
  try {
    sent = await request.json()
  } catch {
    return answer({ error: 'That was not readable.' }, 400)
  }

  const code = typeof sent.code === 'string' ? sent.code : ''
  const client = typeof sent.client === 'string' ? sent.client : ''

  if (!CODE.test(code) || !CLIENTS.has(client)) {
    // Deliberately the same answer as a code that has already been spent, so
    // nothing here tells somebody which of their guesses was closer.
    return answer({ error: 'That sign in link is no longer good.' }, 400)
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )

  // One statement in the database claims it, so two applications racing on
  // the same code cannot both win.
  const { data: claimed, error } = await admin.rpc('claim_app_code', {
    given: code,
    which: client,
  })

  const row = Array.isArray(claimed) ? claimed[0] : null
  if (error || !row?.email) {
    return answer({ error: 'That sign in link is no longer good.' }, 400)
  }

  /*
   * A one-time token the application exchanges with Supabase Auth itself.
   * Handing back a session directly would mean this function minting
   * credentials; this way the exchange happens where it always happens.
   */
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: row.email,
  })

  if (linkError || !link?.properties?.hashed_token) {
    return answer({ error: 'Kobblon could not finish signing you in.' }, 500)
  }

  return answer({
    token_hash: link.properties.hashed_token,
    /** So the application can show whose account it just opened. */
    user_id: row.user_id,
  })
})
