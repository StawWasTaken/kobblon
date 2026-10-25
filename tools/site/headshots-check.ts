/*
 * Whether a stored picture is still the person, under the four cases that
 * decide it. No database and no WebGL: this is the comparison itself, which
 * is the part that was wrong, and it can be checked in a second.
 *
 * The cases are Staw's three sentences turned into questions. Does a
 * picture older than the last change get thrown away? Does a picture that
 * is not of an avatar at all get used? Does a row with no date in it still
 * get the right answer once some other row has said? And does a change made
 * in this browser take effect before anything has been fetched?
 */
import {
  avatarStampFor, markLookChanged, noteAvatarStamp, portraitIsCurrent,
} from '@/lib/headshots'

const who = '11111111-1111-1111-1111-111111111111'
const older = `https://x/${who}/portrait-1000.webp`
const newer = `https://x/${who}/portrait-3000.webp`
const uploaded = `https://x/${who}/somebody-elses-face.png`

const lines: string[] = []
let bad = 0
const is = (what: string, got: unknown, want: unknown) => {
  const ok = got === want
  if (!ok) bad += 1
  lines.push(`${ok ? 'ok  ' : 'FAIL'}  ${what}  (got ${String(got)}, wanted ${String(want)})`)
}

const changed = new Date(2000).toISOString()

is('a portrait older than the change is not them',
  portraitIsCurrent({ avatar_url: older, avatar_changed_at: changed }), false)
is('a portrait newer than the change is them',
  portraitIsCurrent({ avatar_url: newer, avatar_changed_at: changed }), true)
is('an uploaded picture is never used, however new',
  portraitIsCurrent({ avatar_url: uploaded, avatar_changed_at: null }), false)
is('nothing stored is nothing to use',
  portraitIsCurrent({ avatar_url: null, avatar_changed_at: changed }), false)
is('a row with no date takes the stored one on trust, on its own',
  portraitIsCurrent({ avatar_url: older, avatar_changed_at: null }), true)

/* What the store is for: one row said when, so the row that did not say
   gets the same answer. */
noteAvatarStamp(who, changed)
is('the store remembers what the row said',
  portraitIsCurrent({ avatar_url: older, avatar_changed_at: avatarStampFor(who) }), false)

/* An older row arriving afterwards must not undo it. */
noteAvatarStamp(who, new Date(500).toISOString())
is('an older row does not undo a newer one',
  portraitIsCurrent({ avatar_url: older, avatar_changed_at: avatarStampFor(who) }), false)

/* And a change made here, now, before anything has been fetched. */
markLookChanged(who)
is('a change in this browser beats the newest stored picture',
  portraitIsCurrent({ avatar_url: newer, avatar_changed_at: avatarStampFor(who) }), false)

lines.push('', bad ? `${bad} wrong` : 'all of them pass')
document.getElementById('out')!.textContent = lines.join('\n')
