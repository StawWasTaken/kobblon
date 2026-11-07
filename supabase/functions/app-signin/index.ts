/*
 * Turning a one-time code into a session, for a Kobblon application.
 *
 * This is the only place that holds the service role, and it holds it because
 * what it returns decides who somebody is. The application never sees that
 * key: it sends a code it was handed through its protocol link and gets back
 * something it can exchange with Supabase Auth in the ordinary way.
 *
 * The code was minted by the website for a signed-in person, is good for ten
 * minutes, and is spent by the first caller. Everything else about it is
 * enforced in the database rather than here.
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

/** What the application may send, and the only shapes accepted. */
const CODE = /^[A-Za-z0-9_-]{32,128}$/
const CLIENTS = new Set(['launcher', 'creator'])

Deno.serve(async (request) => {
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
  if (error || !row?.user_id) {
    return answer({ error: 'That sign in link is no longer good.' }, 400)
  }

  /*
   * A guest has no address at all, and the exchange below needs one.
   *
   * That used to be a refusal - "finish your Kobblon account first" - which
   * meant a guest could look at every World on the site and open none of
   * them. Staw: guests can play. So the account is given the same stand-in
   * address an account made without an email already gets, at
   * `no-email.kobblon.com`, which exists for this and receives nothing.
   *
   * `profiles.has_email` is not touched, because it records whether there
   * is a person behind the address and there still is not. Nothing else on
   * the site reads the address, so a guest is a guest exactly as before -
   * they can simply get into a World now.
   *
   * It is done here rather than when the guest is made because only the
   * service role may set an address confirmed, and because a guest who
   * never opens an app never needs one.
   */
  let address = row.email as string | null

  if (!address && row.is_guest) {
    address = `nobody-${crypto.randomUUID()}@no-email.kobblon.com`
    const { error: named } = await admin.auth.admin.updateUserById(row.user_id, {
      email: address,
      // Nobody is going to click a link at an address that does not exist.
      email_confirm: true,
    })
    if (named) {
      return answer({ error: 'Kobblon could not finish signing you in.' }, 500)
    }
  }

  /*
   * Still nothing: an account that is not a guest and has no address. That
   * is a different thing from a spent code and is said differently, because
   * telling somebody their link expired when the truth is that their
   * account is not finished sends them round the same loop for ever.
   */
  if (!address) {
    return answer({
      error: 'That account has no email address on it, so it cannot sign in to an app yet.',
    }, 400)
  }

  /*
   * A one-time token the application exchanges with Supabase Auth itself.
   * Handing back a session directly would mean this function minting
   * credentials; this way the exchange happens where it always happens.
   */
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: address,
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
