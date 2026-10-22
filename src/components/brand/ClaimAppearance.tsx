import { useEffect, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useAppearance } from '@/hooks/useAppearance'
import { useMaybeAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/ui/Toast'
import { appearanceOnOffer } from '@/lib/api'
import { asset } from '@/lib/asset'
import { lookOf, type Appearance } from '@/lib/appearances'

/**
 * The card that says an appearance is going.
 *
 * Staw: "make that everyone gets a popup card (with the logomark/wordmark
 * of the appearance) saying that they got it and theres a claim button
 * under which claims it in their theme appearances ... and automatically
 * applies it, and this card ONLY appears on certain periods".
 *
 * Three things it is careful about:
 *
 * **The date is the database's answer.** `appearance_on_offer()` is asked
 * rather than the clock on this machine, because a machine set to December
 * is not an argument, and `claim_appearance` checks the same rule again
 * when the button is pressed. The card is a way of showing somebody that
 * something is there; it is not what decides that it is.
 *
 * **Once a year, and per account rather than per browser.** An account
 * that has not claimed this season's appearance is shown the card for as
 * long as the window is open - on every machine it signs in on, and
 * however many times it has closed the thing, because the offer is the
 * account's and runs out with the window. Staw: "if an account didnt get
 * it yet then keep showing it until the time period is over". Once it is
 * claimed the card still comes round - Staw, "make that even if you
 * already claimed it you should see the card again" - and then closing it
 * puts it away, keyed on the account, the appearance and the year, so
 * next October is a new card and a second account on the same browser
 * gets its own. The card knows the difference: there is nothing to claim
 * twice, so for somebody who has it the button simply puts it on.
 *
 * Which means the decision waits for `settled` - the database's answer
 * about what this account owns. Deciding off the empty list that stands
 * in before it arrives would show an owner the card they put away.
 *
 * **Not on the way in.** It waits for a profile, so nobody signing up meets
 * a card about October before they have an account to put it on.
 */
const PUT_AWAY = 'kobblon.offer-seen'

/** A card seen this October is not a card seen next October. */
const thisYear = () => new Date().getFullYear()

/** The note of having put the card away, which belongs to one account. */
const putAwayKey = (who: string, which: Appearance) =>
  `${PUT_AWAY}:${who}:${which}:${thisYear()}`

export function ClaimAppearance({ offer }: {
  /**
   * Draw the card for this appearance whatever the date says.
   *
   * Only `tools/site/appearance-preview` passes it, so the card can be
   * looked at in July. It does not make the claim go through: that is
   * `claim_appearance`, which checks the date itself and refuses.
   */
  offer?: Appearance
} = {}) {
  const auth = useMaybeAuth()
  const profile = auth?.profile ?? null
  const { appearance, owned, settled, claim, wear } = useAppearance()
  const say = useToast()

  const [offered, setOffered] = useState<Appearance | null>(offer ?? null)
  const [open, setOpen] = useState(!!offer)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (offer || !profile) return
    let live = true
    void appearanceOnOffer()
      .then((which) => { if (live) setOffered((which ?? null) as Appearance | null) })
      .catch(() => { /* nothing on offer, as far as this page is concerned */ })
    return () => { live = false }
  }, [offer, profile])

  useEffect(() => {
    if (offer) return
    if (!offered || !profile || !settled) return
    /*
     * Not claimed yet means shown, whatever this browser remembers. The
     * note only speaks for an account that already has the thing.
     */
    if (owned.includes(offered)) {
      try {
        if (localStorage.getItem(putAwayKey(profile.id, offered))) return
      } catch { /* a blocked store means it is shown, which is the right way round */ }
    }
    setOpen(true)
  }, [offer, offered, owned, settled, profile])

  const putAway = () => {
    if (offered && profile) {
      try {
        localStorage.setItem(putAwayKey(profile.id, offered), '1')
      } catch { /* nothing to do */ }
    }
    setOpen(false)
  }

  if (!offered || !open) return null

  const look = lookOf(offered)
  const had = owned.includes(offered)
  const wearing = appearance === offered

  const take = async () => {
    setClaiming(true)
    try {
      await (had ? wear(offered) : claim(offered))
      say(
        had
          ? `${look.name} is on. Settings has the others whenever you want them.`
          : `${look.name} is yours. You can switch back in Settings whenever you like.`,
        'success',
      )
      putAway()
    } catch (error) {
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={putAway}
      title={`${look.name} is here`}
      description={had
        ? `${look.note} You claimed this one already, so it is yours for good - put it on whenever you like.`
        : `${look.note} ${look.when} Claim it and it is yours for good, this year and every year after.`}
      footer={(
        <div className="flex items-center justify-end gap-2">
          <Button variant="subtle" onClick={putAway}>{had ? 'Later' : 'Not now'}</Button>
          <Button
            onClick={() => void take()}
            loading={claiming}
            disabled={had && wearing}
          >
            {had ? (wearing ? 'You have it on' : 'Wear it') : 'Claim it'}
          </Button>
        </div>
      )}
    >
      {/*
        * The artwork is the whole point of the card, so it is the card: on
        * the season's own chrome colour, at the size it is worth seeing
        * rather than as an icon beside a sentence.
        *
        * Staw drew the mark turning into the halloween one, so that plays
        * here where there is one; a season without a film gets its
        * wordmark standing still, which is the honest version of the same
        * card. The wordmark alone either way - "for the logomark its only
        * when the wordmark is too small", and a card has all the room in
        * the world.
        *
        * The film is only ever fetched by a card that is on screen, which
        * is why it is an `img` here and not a preload in the document: it
        * is a megabyte and a half, and nobody who is not being offered
        * halloween should pay for it.
        */}
      <div
        data-appearance={offered}
        className="grid place-items-center gap-4 rounded-2xl bg-chrome px-6 py-8"
      >
        <img
          src={asset(look.reveal ?? look.wordmark)}
          alt={`The ${look.name} wordmark`}
          className={look.reveal ? 'h-28 w-auto select-none' : 'h-14 w-auto select-none'}
        />
      </div>
    </Dialog>
  )
}
