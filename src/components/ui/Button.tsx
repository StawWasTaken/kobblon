import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { Hop } from '@/components/ui/Hop'
import { Glyph } from '@/components/brand/Glyph'
import type { KobIcon } from '@/components/brand/Icon'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

/*
 * Green is a minority, on purpose.
 *
 * Staw's number is about thirty percent green, the rest blue, red only for
 * deleting, reporting, blocking and warning. The first attempt at "more
 * green" made `primary` green - and `primary` is the default, so every
 * button nobody thought about went green and the ratio came out the other
 * way round. Loud everywhere is the same as quiet everywhere.
 *
 * So: `primary` is blue again and stays the workhorse. `yes` is green and is
 * said on purpose - the one action a screen is for. Save, publish, upload,
 * accept, play. One per screen, usually; if two buttons on a screen are both
 * green, one of them is wrong.
 *
 * Blue is what you are standing inside, green is the answer that means yes,
 * red is danger and nothing else.
 */
type Variant = 'primary' | 'yes' | 'enter' | 'brand' | 'ghost' | 'subtle' | 'danger'
type Size = 'sm' | 'md' | 'lg'

/*
 * The solid variants carry `text-on-art`, not `text-white`.
 *
 * `white` is the theme's foreground, so in daylight it is near-black - and
 * a label is only white here because brand blue, Space green and the red
 * are fixed colours that do not flip with the theme. They were all reading
 * as dark text on a bright button the moment somebody turned the lights on.
 *
 * `ghost` and `subtle` keep `text-white` on purpose: they sit on a theme
 * surface, so their label is supposed to flip with it.
 */
/*
 * The lip under a solid button is that button's own colour turned down,
 * never black.
 *
 * Blue was the one that broke the rule: green has always worn `space-deep`
 * and blue wore `brand-ink` (#0d1349), which against the face reads as a
 * black edge rather than as the same blue in shadow. On a dark page nobody
 * could tell; the applications put a blue button on a white sign-in card
 * and Staw saw it at once - "the 3d shadow is not black but a darker brand
 * blue". It is `brand-deep` now, which is the same hue turned down, and it
 * matches how green and red were already built.
 */
/*
 * Green behaves exactly like blue: it lightens under the pointer.
 *
 * It spent one round darkening instead, because white on `space-bright` is
 * 2.86 and a green button that brightens spends its hover under AA. Staw
 * looked at it: "i dont like how the green buttons behave - make them
 * behave like the blue buttons again (keep the green colour)". A button
 * that goes the other way from every other button on the site reads as
 * broken, and that is a worse thing to be than dim for the half second a
 * pointer is on it - the label is still there, it is the contrast ratio
 * that drops, and nothing is decided during a hover.
 *
 * So all four solid variants are one rule now: resting fill, lighter on
 * hover, back to the resting fill on the press, and the lip disappears
 * under it.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-on-art hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-deep active:border-b-0 active:mt-[3px]',
  /** The one thing this screen is for. Said on purpose, not by default. */
  yes:
    'bg-space text-on-art hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]',
  /** Going into a World, which is the loudest yes Kobblon has. */
  enter:
    'bg-space text-on-art hover:bg-space-bright active:bg-space border-b-[3px] border-space-deep active:border-b-0 active:mt-[3px]',
  /** The same blue as primary, kept for callers that name the platform. */
  brand:
    'bg-brand text-on-art hover:bg-brand-bright active:bg-brand border-b-[3px] border-brand-deep active:border-b-0 active:mt-[3px]',
  ghost:
    'bg-transparent text-white/80 hover:bg-white/10 hover:text-white border-2 border-transparent',
  /*
   * A block too, and this is the one that changed the page most.
   *
   * `subtle` is the second button in nearly every pair on Kobblon - Cancel
   * beside Save, Follow beside Message - and it was a 1px outline standing
   * next to a solid button with a 3px lip. The pair read as "a button, and
   * some text that happens to be in a box", which is not what a choice
   * between two things should look like.
   *
   * Same stroke and the same side face as everything else now, and it
   * presses the same way: the lip disappears and the button moves down into
   * it. The fill is what says it is the quieter one, not the weight.
   *
   * The lip is the stroke, thicker - not `ink-edge`. A near-black bottom
   * edge under a pale grey outline is the one place on the site where the
   * two strokes round a single shape were different colours, and Staw: "i
   * dont like the black shadow it feels weird with the stroke around it".
   * He is describing the mismatch rather than the depth: a card does this
   * with one colour at two widths and reads as a block, and a button that
   * draws its own shadow in a different colour reads as a button with
   * something underneath it. Every solid variant already follows this rule
   * - the lip is that button's own colour turned down - and this is the
   * last one that was not.
   */
  subtle:
    'bg-ink-hover text-white hover:bg-ink-line border-2 border-ink-line '
    + 'border-b-[3px] active:border-b-2 active:mt-[1px]',
  /*
   * Built exactly like primary and yes, in red. Staw: a red button should be
   * just like a blue or a green one, only red.
   *
   * It was the one tinted outline button on the site, so "Remove it" - the
   * press that most needs to look like a decision somebody made - read as
   * fainter than "Keep it" beside it. Same weight now; the colour is what
   * says it is different, which is the whole job of having one red.
   *
   * The lip is `danger-deep` now, not `danger-ink`. Blue moved off `ink`
   * last round and red was the last one left on it, which made the one
   * button that deletes things press with a heavier edge than every other
   * button on the site. Staw: match it.
   */
  danger:
    'bg-danger text-on-art hover:bg-danger-bright active:bg-danger border-b-[3px] border-danger-deep active:border-b-0 active:mt-[3px]',
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2.5 rounded-xl',
}

const base =
  // `font-bold`, not semibold: a control on a gamified page is a thing you
  // press, and it should look like it carries its own weight.
  'inline-flex items-center justify-center font-bold transition-[background-color,transform,box-shadow] duration-150 ' +
  'active:translate-y-px disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
  icon?: IconDefinition
  /**
   * Whether what this button toggles is on, for the icons Staw drew twice
   * - a star, a heart, a thumb. Left out, those stay Font Awesome's,
   * because the filled drawing means "you pressed it" and showing it to
   * somebody who has not is a lie the page tells about them.
   */
  iconOn?: boolean
  /**
   * One of ours by name, where the Font Awesome stand-in means something
   * else elsewhere - a clock that is "waiting to be friended" rather than
   * a clock, a heart that is "best friend" rather than a like.
   */
  iconName?: KobIcon
  iconRight?: IconDefinition
  loading?: boolean
  to?: string
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconOn, iconName, iconRight, loading, to, block, className, children, ...props },
  ref,
) {
  const classes = cn(base, variants[variant], sizes[size], block && 'w-full', className)
  const inner = (
    <>
      {loading ? (
        <Glyph icon={faSpinner} className="animate-spin" />
      ) : (
        icon && <Glyph icon={icon} name={iconName} on={iconOn} />
      )}
      {children}
      {iconRight && !loading && <Glyph icon={iconRight} />}
    </>
  )

  if (to) {
    return (
      <Hop to={to} className={classes}>
        {inner}
      </Hop>
    )
  }

  return (
    <button ref={ref} className={classes} disabled={loading || props.disabled} {...props}>
      {inner}
    </button>
  )
})
