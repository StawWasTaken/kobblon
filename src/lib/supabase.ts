import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/*
 * The client everything talks to, and a way to hand it a different one.
 *
 * The website's own client keeps its session in localStorage, which is right
 * for a browser tab: it is how a refresh does not sign you out. Kobblon
 * Workspace deliberately does the opposite — its session lives in memory and
 * its refresh token in the operating system's keychain, so there is no
 * readable copy on disk for a fake Workspace to steal.
 *
 * So a component of ours mounted inside the Workspace used to be a component
 * talking to a client with no session: it rendered perfectly and would have
 * uploaded as nobody. That was invisible from this side, and it was papered
 * over there with a build alias pointing this module somewhere else.
 *
 * `setSupabaseClient` is the seam instead. Everything here imports `supabase`
 * exactly as it always has and never learns which client it got; whoever owns
 * the session says once, at startup, which one that is.
 */

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(url && key)

/** The one somebody handed us, if anybody did. */
let given: SupabaseClient | null = null
/** The website's own, built the first time it is actually wanted. */
let own: SupabaseClient | null = null

function website(): SupabaseClient {
  if (own) return own
  if (!isSupabaseConfigured) {
    console.warn('Supabase is not configured. Copy .env.example to .env and fill it in.')
  }
  own = createClient(url ?? 'http://localhost', key ?? 'anon', {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return own
}

/**
 * Talk to this one instead.
 *
 * Said once, before anything else runs. Passing null goes back to the
 * website's own client, which is what a test wants when it is finished.
 *
 * Building the website's client is deferred until something asks for it, so
 * an application that calls this at startup never builds one at all — and
 * never warns about configuration it does not have and does not need.
 */
export function setSupabaseClient(client: SupabaseClient | null) {
  given = client
}

/** Whichever client is being served right now. */
export const currentSupabase = (): SupabaseClient => given ?? website()

/**
 * A stand-in that asks, every time, which client it should be.
 *
 * A plain `export const supabase = …` is decided at import, which is before
 * an application has had the chance to say. This forwards instead, so the
 * two hundred and sixty places that say `supabase.from(…)` keep saying it
 * and none of them has to know.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const real = currentSupabase() as unknown as Record<string | symbol, unknown>
    const value = real[property]
    // Methods have to keep their own `this`, or the client loses itself.
    return typeof value === 'function' ? value.bind(real) : value
  },
  set(_target, property, value) {
    (currentSupabase() as unknown as Record<string | symbol, unknown>)[property] = value
    return true
  },
  has(_target, property) {
    return property in (currentSupabase() as unknown as object)
  },
})
