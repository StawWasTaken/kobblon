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
 * Anything else stored under `avatar_url` has no stamp to read and is left
 * alone: unknown is not the same as old, and throwing away a picture nobody
 * can date would be throwing away every picture from before this existed.
 */
export function portraitIsCurrent(person?: {
  avatar_url?: string | null
  avatar_changed_at?: string | null
} | null): boolean {
  if (!person?.avatar_url) return false
  const stamp = /portrait-(\d+)\.webp/.exec(person.avatar_url)?.[1]
  if (!stamp || !person.avatar_changed_at) return true
  return Number(stamp) >= new Date(person.avatar_changed_at).getTime()
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

  const work = (async () => {
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
    return picture ? URL.createObjectURL(picture) : null
  })()

  // One context at a time. The queue is the whole of it: each draw waits for
  // the one before, so twenty faces appear one after another rather than
  // nineteen of them failing to get a renderer.
  const queued = queue.then(() => work).catch(() => null)
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
  if (had) URL.revokeObjectURL(had)
  drawn.delete(userId)
  drawing.delete(userId)
  tell()
}
