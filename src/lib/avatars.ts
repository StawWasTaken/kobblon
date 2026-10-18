/*
 * There are no stock pictures any more, and that now includes guests.
 *
 * Eight Kobby pictures were handed out at random so that an account always
 * had something, and a ninth - `guest-avatar.png` - stood in for everybody
 * passing through. Both are gone for the same reason: a profile picture is a
 * shot of the person's own avatar, so a stock picture is not a fallback, it
 * is a different face sitting on their account until they notice. A guest
 * has a real avatar - white body, the guest shirt, trousers and cap - and
 * showing a stock face instead was showing somebody who does not exist.
 *
 * Nothing has one, `avatar_url` being empty is the ordinary state, and what
 * fills it is `useHeadshot`, which draws the avatar there and then.
 */

/**
 * The picture stored for somebody, if there is one.
 *
 * Null is not a gap to paper over here - `Avatar` takes that null and draws
 * the person instead, which is the whole of Staw's "if theres no pfp then
 * the avatar must render IMMEDIATELY".
 */
export function avatarOf(
  person?: { avatar_url?: string | null } | null,
): string | null {
  return person?.avatar_url || null
}

/**
 * Somebody who is not there any more.
 *
 * Two different things end up here and they look the same from outside: an
 * account on its way out, which carries `closed_at` and the two months
 * before the data actually goes, and one closed for good. The row is still
 * readable in both cases on purpose - Staw: an old friend in a list should
 * read "Account Deleted" with a picture that will not load, not vanish and
 * leave somebody wondering whether they were blocked.
 *
 * A warning and a suspension are not this. A suspended account looks
 * entirely normal to everybody else, which is the whole of the change to
 * `profiles_read` in migration 0267.
 */
export function isGone(
  person?: { closed_at?: string | null; is_banned?: boolean | null } | null,
): boolean {
  return !!person && (!!person.closed_at || !!person.is_banned)
}

/** What to call them once there is nobody behind the name. */
export function nameOf(
  person?: {
    display_name?: string | null
    closed_at?: string | null
    is_banned?: boolean | null
  } | null,
  fallback = '?',
): string {
  if (isGone(person)) return 'Account Deleted'
  return person?.display_name || fallback
}
