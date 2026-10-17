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
 * **Once.** Shown while the window is open and the appearance has not been
 * claimed, and put away for good on this device once somebody has pressed
 * either button - a popup that comes back on every page is not an offer,
 * it is a nag. The claim itself lives on the account, so the card never
 * returns anywhere once it has actually been taken.
 *
 * **Not on the way in.** It waits for a profile, so nobody signing up meets
 * a card about October before they have an account to put it on.
 */
const PUT_AWAY = 'kobblon.offer-seen'

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
  const { owned, claim } = useAppearance()
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
    if (!offered || !profile) return
    if (owned.includes(offered)) return
    try {
      if (localStorage.getItem(`${PUT_AWAY}:${offered}`)) return
    } catch { /* a blocked store means it is shown, which is the right way round */ }
    setOpen(true)
  }, [offer, offered, owned, profile])

  const putAway = () => {
    if (offered) {
      try { localStorage.setItem(`${PUT_AWAY}:${offered}`, '1') } catch { /* nothing to do */ }
    }
    setOpen(false)
  }

  if (!offered || !open) return null

  const look = lookOf(offered)

  const take = async () => {
    setClaiming(true)
    try {
      await claim(offered)
      say(`${look.name} is yours. You can switch back in Settings whenever you like.`, 'success')
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
      description={`${look.note} ${look.when} Claim it and it is yours for good, this year and every year after.`}
      footer={(
        <div className="flex items-center justify-end gap-2">
          <Button variant="subtle" onClick={putAway}>Not now</Button>
          <Button onClick={() => void take()} loading={claiming}>Claim it</Button>
        </div>
      )}
    >
      {/*
        * The artwork is the whole point of the card, so it is the card: the
        * mark on the season's own chrome colour, drawn at the size it is
        * actually worth seeing rather than as an icon beside a sentence.
        */}
      <div
        data-appearance={offered}
        className="grid place-items-center gap-4 rounded-2xl bg-chrome px-6 py-8"
      >
        <img
          src={asset(look.wordmark)}
          alt={`The ${look.name} wordmark`}
          className="h-14 w-auto select-none"
        />
        <img
          src={asset(look.logomark)}
          alt=""
          aria-hidden
          className="h-12 w-auto select-none"
        />
      </div>
    </Dialog>
  )
}
