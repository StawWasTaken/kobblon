/*
 * Somebody's face, drawn now, when nothing is stored for them.
 *
 * Staw: "new accounts & guest accounts shouldnt have no profile picture, the
 * profile picture is from their avatar, so even if they didnt even touch it
 * yet, the pfp is already their avatars face" - and then "if theres no pfp
 * then the avatar must render IMMEDIATELY".
 *
 * `refreshPortrait` already draws one and keeps it, but only the person
 * themselves can write to their own row, so it can only ever fire for the
 * account that is looking. Everybody else - a name in a chat, a row in a
 * friends list, a guest who has never opened My Avatar - would show initials
 * for ever waiting for them to visit their own page. So the picture is drawn
 * in the browser that needs it.
 *
 * Three things keep that from being expensive:
 *
 *   * **One draw per person per page**, shared. A list of twenty rows for
 *     one person is one draw, because the promise is cached by id and the
 *     second caller waits on the first rather than starting another.
 *   * **Only when there is nothing stored.** The moment somebody has a
 *     picture, this is never reached.
 *   * **One at a time.** Each draw builds a WebGL context and frees it, and
 *     a browser hands out a handful - twenty at once is a page where most of
 *     them come back blank. They queue.
 *
 * It is a drawing, not a saving: nothing here writes to anybody's profile.
 * Writing another person's row is not something a page may do, and should
 * not be - the account's own `refreshPortrait` is what makes it permanent.
 */
import { drawPortrait } from './portrait'

/**
 * Whether the picture somebody has stored still shows who they are.
 *
 * A portrait is saved as `portrait-<when>.webp` - a new name each time,
 * because a public bucket is cached by every browser that has ever shown it -
 * and the database says when the avatar last changed. Older means the stored
 * picture is of who they used to be.
 *
 * Anything else stored under `avatar_url` is not a picture of their avatar,
 * and Staw's rule is that a profile picture always is one: "i want the
 * profile picture to be always based on the avatar". So an uploaded or
 * inherited picture does not count, and the face is drawn from the avatar
 * instead. Nothing is deleted - the row keeps whatever it holds - it is
 * simply not what gets shown.
 */
export function portraitIsCurrent(person?: {
  avatar_url?: string | null
  avatar_changed_at?: string | null
} | null): boolean {
  if (!person?.avatar_url) return false
  const stamp = /portrait-(\d+)\.webp/.exec(person.avatar_url)?.[1]
  if (!stamp) return false
  if (!person.avatar_changed_at) return true
  return Number(stamp) >= new Date(person.avatar_changed_at).getTime()
}

/*
 * Faces drawn in an earlier page of this tab.
 *
 * A drawing costs a fetch, a WebGL context and a render, and a reload threw
 * every one of them away - so every face on the page was drawn again from
 * nothing, which is what "profile pictures take time to reload" is. They are
 * kept for the life of the tab, as data rather than as a blob address: an
 * object URL belongs to the page that made it and is dead on the next one.
 *
 * Ten minutes, because nothing here can tell whether somebody has changed
 * their avatar since. Your own is not subject to it: changing anything calls
 * `forgetHeadshot`, which clears this too.
 */
const KEPT = 'kob.faces'
const KEPT_FOR = 10 * 60 * 1000
const KEPT_MOST = 60

type KeptFace = { at: number; url: string }

function keptAll(): Record<string, KeptFace> {
  try {
    return JSON.parse(sessionStorage.getItem(KEPT) ?? '{}') as Record<string, KeptFace>
  } catch {
    return {}
  }
}

function keptFace(userId: string): string | null {
  const one = keptAll()[userId]
  if (!one || Date.now() - one.at > KEPT_FOR) return null
  return one.url
}

async function keepFace(userId: string, picture: Blob) {
  try {
    const url: string = await new Promise((done, fail) => {
      const reader = new FileReader()
      reader.onload = () => done(String(reader.result))
      reader.onerror = () => fail(reader.error)
      reader.readAsDataURL(picture)
    })
    const all = keptAll()
    all[userId] = { at: Date.now(), url }
    // Oldest first out, so a long session does not fill the tab's storage.
    const names = Object.keys(all)
      .sort((a, b) => all[b].at - all[a].at)
      .slice(0, KEPT_MOST)
    sessionStorage.setItem(KEPT, JSON.stringify(
      Object.fromEntries(names.map((name) => [name, all[name]])),
    ))
  } catch {
    // A full or refused storage is not worth failing a picture over.
  }
}

function dropKeptFace(userId: string) {
  try {
    const all = keptAll()
    delete all[userId]
    sessionStorage.setItem(KEPT, JSON.stringify(all))
  } catch {
    // Same: nothing here is worth throwing for.
  }
}

/** What has been drawn, by person. `null` means tried and could not. */
const drawn = new Map<string, string | null>()
/** What is being drawn, so twenty rows for one person are one draw. */
const drawing = new Map<string, Promise<string | null>>()
/** Who wants to be told when one finishes. */
const waiting = new Set<() => void>()

let queue: Promise<unknown> = Promise.resolve()

/** Tells every mounted picture to look again. */
function tell() {
  for (const one of [...waiting]) one()
}

/**
 * The drawn face for somebody, or null while there is not one yet.
 *
 * Synchronous on purpose: a component asks during render and gets whatever
 * is known at that moment, which is the picture itself on every render after
 * the first. The work it starts reports back through `watch`.
 */
export function headshotFor(userId: string): string | null {
  return drawn.get(userId) ?? null
}

/** Whether somebody's has been tried, finished or failed. */
export function headshotKnown(userId: string): boolean {
  return drawn.has(userId)
}

/** Starts one if nobody has, and hands back the same promise if somebody has. */
export function askForHeadshot(userId: string): Promise<string | null> {
  const already = drawing.get(userId)
  if (already) return already

  const kept = keptFace(userId)
  if (kept) {
    drawn.set(userId, kept)
    return Promise.resolve(kept)
  }

  const work = async () => {
    /*
     * The look is fetched through `api`, which is imported here rather than
     * at the top on purpose: `api` decides its Supabase client at call time
     * and this module is imported by `Avatar`, which the Workspace mounts
     * before it has said which session it has. Importing it up here would
     * pull the whole data layer into every panel that shows a face.
     */
    const { lookOf } = await import('./api')
    const look = await lookOf(userId).catch(() => null)
    if (!look) return null
    const picture = await drawPortrait(look).catch(() => null)
    if (!picture) return null
    void keepFace(userId, picture)
    return URL.createObjectURL(picture)
  }

  /*
   * One context at a time, and this is the line that was wrong.
   *
   * It read `queue.then(() => work)` with `work` an **already started**
   * promise, so the queue waited for each draw in order and every one of
   * them had begun the moment it was asked for. Twenty faces on a page were
   * twenty fetches and twenty WebGL contexts at once, which is exactly what
   * the queue was written to prevent - the comment said one at a time and
   * the code said all at once. CLAUDE.md's second trap: a guard that exists,
   * is checked, and watches nothing.
   *
   * `work` is a function now, so the queue is what calls it.
   */
  const queued = queue.then(work).catch(() => null)
  queue = queued

  const held = queued.then((url) => {
    drawn.set(userId, url)
    drawing.delete(userId)
    tell()
    return url
  })

  drawing.set(userId, held)
  return held
}

/** Called when any face finishes drawing. Hands back the way to stop. */
export function watchHeadshots(listener: () => void): () => void {
  waiting.add(listener)
  return () => { waiting.delete(listener) }
}

/**
 * Forgets somebody's, so the next look draws it again.
 *
 * Called when they change what they are wearing: a cached face is otherwise
 * the face they had before they put the hat on, for as long as the page is
 * open.
 */
export function forgetHeadshot(userId: string) {
  const had = drawn.get(userId)
  if (had && had.startsWith('blob:')) URL.revokeObjectURL(had)
  dropKeptFace(userId)
  drawn.delete(userId)
  drawing.delete(userId)
  tell()
}
