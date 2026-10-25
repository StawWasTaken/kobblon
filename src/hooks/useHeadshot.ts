/*
 * The face to show for somebody: what is stored, or what they look like.
 *
 * The second half is the part Staw asked for. An account that has never
 * opened My Avatar - every new one, and every guest - has nothing stored,
 * and showing initials there is showing a placeholder for a person whose
 * avatar is sitting in the database fully dressed. So it is drawn, in the
 * browser that needs it, and appears as soon as it is ready.
 */
import { useEffect, useState } from 'react'
import {
  askForAvatarStamp, askForHeadshot, avatarStampFor, headshotFor, headshotKnown,
  noteAvatarStamp, portraitIsCurrent, watchHeadshots,
} from '@/lib/headshots'

export function useHeadshot(
  personId: string | null | undefined,
  stored: string | null | undefined,
  /**
   * When they last changed their avatar. With it, a stored picture taken
   * before that is ignored and a current one drawn - which is the whole of
   * Staw's "everytime you change avatars, it updates", for everybody looking
   * rather than only for the account that happened to be on its own avatar
   * page when it changed.
   */
  changedAt?: string | null,
): string | null {
  const [, nudge] = useState(0)

  /*
   * When their avatar last changed, from whichever of the two knows.
   *
   * A row that carries the date teaches the store on the way past, and a
   * row that does not - a forum byline, a chat message, a ticket - reads
   * what some other row already said. That is the whole of "the same image
   * everywhere": thirty-four places draw a face from a row with no date in
   * it, and before this they each took whatever was stored on trust, so one
   * person could wear last March's face on the forum and this morning's on
   * their profile.
   *
   * The store wins when it is ahead, because it is also where a change made
   * in this browser a second ago is recorded - the row saying so has not
   * been fetched yet.
   */
  if (personId && changedAt) noteAvatarStamp(personId, changedAt)
  const known = personId ? avatarStampFor(personId) ?? changedAt : changedAt

  const current = portraitIsCurrent({ avatar_url: stored, avatar_changed_at: known })
  const usable = current ? stored : null

  useEffect(() => {
    /*
     * Nobody has said when this one last changed, so ask - in a batch, once
     * per person per tab. Asked even while a stored picture is being shown:
     * showing it and swapping it if the answer says it is old beats drawing
     * every face on the page from nothing on the chance that one of them is.
     */
    if (personId && !changedAt) askForAvatarStamp(personId)
  }, [personId, changedAt])

  useEffect(() => {
    // Nothing to draw, or nothing to draw it for.
    if (usable || !personId) return

    /*
     * The trap, in its usual clothes: the person being drawn can change
     * while this is in flight. The listener is what makes that safe - it is
     * removed on the way out, so a draw that lands after this picture has
     * moved on tells nobody, and the answer it stored is simply there for
     * whoever asks next.
     */
    const stop = watchHeadshots(() => nudge((n) => n + 1))
    if (!headshotKnown(personId)) void askForHeadshot(personId)
    return stop
  }, [personId, usable])

  if (usable) return usable
  return personId ? headshotFor(personId) : null
}
