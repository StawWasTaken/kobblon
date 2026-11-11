/*
 * Whether the database is answering at all - and the shutters coming down
 * by themselves when it is not.
 *
 * Staw: "i want that when theres an issue about the database, instead of
 * saying that stuff cant load bc of the database, make that the in
 * maintenance mode is automatically activated."
 *
 * The thing that makes this awkward, and the reason it lives in the browser
 * rather than in a trigger: **the switch is a row in the database.** When
 * the database is the thing that has fallen over, nothing can write
 * `site_state.maintenance = true`, and nothing can read it either. A server
 * that could be asked to put the curtain up is a server that is working. So
 * the curtain has to be something each tab can decide on its own, from the
 * only evidence it has - that its own calls have stopped being answered.
 *
 * It is not the maintenance switch and it does not touch it. Staff throw
 * that one deliberately and it says what they wrote. This is the other
 * thing: the site noticing it has gone deaf, drawing the same page rather
 * than twenty "that did not load" boxes, and taking it down again the
 * moment a call succeeds.
 *
 * ## The part to get right
 *
 * **A refusal is not an outage.** `permission denied`, `Sign in first.`,
 * `You need to be 15 or over`, a row that is not there - those are the
 * database working perfectly and saying no, and a hundred of them in a row
 * still means it is up. Counting them would shutter the whole site every
 * time somebody opened a page they are not allowed to see, which is a much
 * worse bug than the one this fixes.
 *
 * So only *transport* failures count: the fetch never completed, or it came
 * back as the gateway rather than as PostgREST. Everything else is an
 * answer, and an answer - even a no - clears the count.
 *
 * ## The guard and what invalidates it
 *
 * CLAUDE.md's second trap is a guard that watches the wrong event, and the
 * check it asks for is "name the events that should change this, and show
 * it changes on each". Four:
 *
 *   * a call comes back, with anything at all  ->  reachable, at once
 *   * a call fails to reach it, under the run  ->  no change yet
 *   * a call fails to reach it, reaching the run ->  unreachable
 *   * the browser says the machine went offline ->  unreachable, at once
 *
 * The last one matters because somebody closing their laptop lid is the
 * common case, and `navigator.onLine` says so before three calls have had
 * time to fail.
 */

/** How many transport failures in a row before the curtain comes down. */
const RUN = 3

/**
 * How long a failure stays on the count. A failure an hour ago is not part
 * of a run with one now; without this, three unrelated hiccups across a
 * long session would eventually add up to an outage that never happened.
 */
const WINDOW = 30_000

type State = { reachable: boolean; since: number | null }

let failures: number[] = []
let reachable = true
let since: number | null = null
const listeners = new Set<(state: State) => void>()

function tell() {
  const state: State = { reachable, since }
  for (const listener of listeners) listener(state)
}

function fall() {
  if (!reachable) return
  reachable = false
  since = Date.now()
  tell()
}

function rise() {
  failures = []
  if (reachable) return
  reachable = true
  since = null
  tell()
}

/**
 * Whether a failure was the database refusing or the database missing.
 *
 * Deliberately a small list of shapes that mean "never got there", rather
 * than a list of shapes that mean "refused": the refusals are every
 * `raise exception` in three hundred migrations and cannot be enumerated,
 * while the ways a request fails to arrive are few and well known.
 *
 * `TypeError: Failed to fetch` is what a browser says when it could not
 * open the connection at all, which covers the machine being offline, DNS,
 * TLS and the project being asleep. The rest are the gateway in front of
 * PostgREST answering instead of PostgREST.
 */
export function looksLikeAnOutage(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error ?? '')
  ).toLowerCase()
  if (!message) return false

  return (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('network request failed')
    || message.includes('load failed')
    || message.includes('fetch failed')
    || message.includes('err_connection')
    || message.includes('err_network')
    || message.includes('timeout')
    || message.includes('upstream connect')
    || message.includes('service unavailable')
    || message.includes('bad gateway')
    || message.includes('gateway timeout')
    || message.includes('database is not reachable')
    || message.includes('too many connections')
    || message.includes('server is starting up')
    || message.includes('no response from server')
  )
}

/**
 * A call came back. Anything at all, including a refusal.
 *
 * This is the only thing that lifts the curtain, and it is why the curtain
 * cannot stick: the website keeps asking while it is down, so the first
 * answer of any kind ends it.
 */
export function reached() {
  rise()
}

/**
 * A call failed. Returns whether it was counted as an outage, so a caller
 * can tell "the database said no" from "the database is not there".
 */
export function failed(error: unknown): boolean {
  if (!looksLikeAnOutage(error)) {
    // An answer, even an unwelcome one. The database is plainly up.
    rise()
    return false
  }

  const now = Date.now()
  failures = failures.filter((at) => now - at < WINDOW)
  failures.push(now)
  if (failures.length >= RUN) fall()
  return true
}

/** Whether the database is answering, as far as this tab can tell. */
export const databaseReachable = () => reachable

/** When it stopped answering, or null while it is answering. */
export const unreachableSince = () => since

/**
 * Watch it. Returns the undo.
 *
 * Told the current state immediately rather than only on the next change,
 * so something that mounts during an outage draws the outage instead of
 * waiting for a fourth failed call to find out.
 */
export function watchReachable(listener: (state: State) => void) {
  listeners.add(listener)
  listener({ reachable, since })
  return () => { listeners.delete(listener) }
}

/*
 * The machine itself going offline, which beats waiting for three calls to
 * time out. Coming back online does not lift the curtain on its own - a
 * network interface is not the database - but it is worth a retry, and the
 * first call that succeeds lifts it.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('offline', fall)
}
