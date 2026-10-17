// Making an account without an email, and giving one a password afterwards.
//
// Supabase wants an address for every account it holds. Staw's rule is that
// a person should not need one to join Kobblon, so an account made without
// one gets a stand-in at `no-email.kobblon.com` - a domain that exists for
// this and receives nothing - and `profiles.has_email` records, from the
// address itself, that there is nobody behind it.
//
// That has to happen here rather than in the browser, for two reasons:
//
//   * `auth.signUp` sends a confirmation email, and sending one to a
//     stand-in address means a bounce for every account made this way. The
//     service role can create the account already confirmed; the browser
//     cannot, and should not be able to.
//   * The address has to be unique and unguessable. A browser picking it
//     could pick somebody else's.
//
// The second job is the other end of the same thing: a guest a superadmin
// made real is signed in, has no password, and the site shows them a card
// asking for one. Setting it turns the anonymous account into a permanent
// one, which again only the service role may do.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

/** An address nobody can receive at, and nobody else can guess. */
function standInAddress() {
  return `nobody-${crypto.randomUUID()}@no-email.kobblon.com`
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return json({ error: 'Send something.' }, 400)
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })

  const password = String(body.password ?? '')
  if (password.length < 8) return json({ error: 'A password is at least 8 characters.' }, 400)

  // ----------------------------------------------------- an account arrives

  if (body.action === 'signup') {
    const username = String(body.username ?? '').trim()
    const displayName = String(body.display_name ?? '').trim()
    const birthDate = String(body.birth_date ?? '').trim()
    const gender = String(body.gender ?? '').trim()

    if (!birthDate) return json({ error: 'A birthday is needed.' }, 400)

    /*
     * The same checks the form runs, run again where they cannot be
     * skipped by talking to this function directly. `check_username` is
     * the one that screens the name, so a handle Kobby would refuse never
     * becomes an account in the first place.
     */
    const { data: verdict, error: checked } = await admin.rpc('check_username', { name: username })
    const answer = Array.isArray(verdict) ? verdict[0] : verdict
    if (checked) return json({ error: 'That name could not be checked. Try again.' }, 400)
    if (!answer?.ok) return json({ error: answer?.reason ?? 'Pick a different username.' }, 400)

    const email = standInAddress()
    const { data: made, error: failed } = await admin.auth.admin.createUser({
      email,
      password,
      // Nobody is going to click a link at an address that does not exist.
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName || username,
        avatar_url: '',
        birth_date: birthDate,
        gender,
      },
    })

    if (failed || !made.user) {
      return json({ error: failed?.message ?? 'That did not go through.' }, 400)
    }

    const { data: session, error: refused } = await anon.auth.signInWithPassword({ email, password })
    if (refused || !session.session) {
      return json({ error: 'The account was made but signing in did not work. Try signing in.' }, 400)
    }

    return json({
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
    })
  }

  // ------------------------------------------- a password, set afterwards

  if (body.action === 'set-password') {
    /*
     * Who is asking, read from their own token rather than from anything
     * they sent. This function answers without a session for the signup
     * above, so the check is made here instead of by the gateway.
     */
    const bearer = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? ''
    const { data: asked } = await admin.auth.getUser(bearer)
    const who = asked.user
    if (!who) return json({ error: 'You are not signed in.' }, 401)

    const { data: profile } = await admin
      .from('profiles')
      .select('id, must_set_password, is_guest')
      .eq('id', who.id)
      .maybeSingle()

    if (!profile) return json({ error: 'No such account.' }, 400)
    // Only the account the site is actually waiting on. Anybody else who
    // wants a new password has the ordinary way of changing one.
    if (!profile.must_set_password) return json({ error: 'This account already has a password.' }, 400)

    const email = who.email && !who.email.endsWith('@no-email.kobblon.com')
      ? who.email
      : standInAddress()

    const { error: failed } = await admin.auth.admin.updateUserById(who.id, {
      email,
      password,
      email_confirm: true,
    })
    if (failed) return json({ error: failed.message }, 400)

    await admin
      .from('profiles')
      .update({ must_set_password: false, has_email: !email.endsWith('@no-email.kobblon.com') })
      .eq('id', who.id)

    return json({ ok: true })
  }

  return json({ error: 'Say which of the two this is.' }, 400)
})
