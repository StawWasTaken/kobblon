import { asset } from './asset'

/*
 * There are no stock pictures any more.
 *
 * Eight Kobby pictures were handed out at random so that an account always
 * had something. A profile picture is now a shot of the person's own avatar,
 * drawn from the body they are wearing - so a stock picture is not a
 * fallback, it is a different person's face on their account until they
 * notice. Nothing has one, and `avatar_url` being empty is the ordinary
 * state rather than a gap to fill.
 */

/** Guests all wear the same face, so it is obvious who is passing through. */
export const guestAvatar = asset('/brand/guest-avatar.png')

/**
 * The picture to show for somebody.
 *
 * Whatever is stored, which is now a drawing of their own avatar. A guest
 * who has not had one drawn yet falls back to the guest face rather than to
 * nothing - but a guest who has one keeps it, because a guest has a real
 * avatar now and hiding it would be showing a face that is not theirs.
 */
export function avatarOf(
  person?: { avatar_url?: string | null; is_guest?: boolean | null } | null,
): string | null {
  if (!person) return null
  if (person.avatar_url) return person.avatar_url
  return person.is_guest ? guestAvatar : null
}
