import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Icon, type KobIcon } from '@/components/brand/Icon'
import { cn } from '@/lib/cn'

/**
 * An icon, ours where we have one and Font Awesome where we do not.
 *
 * Staw: "replace every icon used on the kobblon website that are from
 * fontawesome if they can be replaced by our own". The hard part is not the
 * swapping, it is that there are something like nine hundred call sites and
 * most of them are not `<FontAwesomeIcon>` at all - they are `icon={faUser}`
 * handed to a Button, a Menu, an EmptyState, a PageHeader. Rewriting all of
 * those by hand is a day's work and a hundred chances to break one.
 *
 * So the swap happens in one place instead. This takes exactly what
 * `FontAwesomeIcon` takes, looks the icon up by its Font Awesome name, and
 * draws Staw's if there is one. Every component that renders an icon uses
 * this, so `icon={faBell}` on a button three files away is already his
 * notification bell with nothing at that call site changed - and the day he
 * draws a calendar, one line here puts it everywhere a calendar appears.
 *
 * Matched on `iconName`, which is Font Awesome's own stable identifier
 * ("user", "bell") rather than the import name - so the solid and the
 * regular weight of the same glyph both find ours, which is right: we have
 * one drawing of a bell.
 *
 * `tone` is how ours are painted where they have to match the text they sit
 * beside. Our icons are pictures and carry their own colours; most of them
 * are white line art, which is why the default here is to paint them with
 * `currentColor` and let them behave like a glyph. A caller that wants the
 * drawing as drawn passes `tone={null}`.
 */

/**
 * Font Awesome's name for a glyph, to the one Staw drew for it.
 *
 * By what the name **means**, not by what the drawing resembles. Staw, of
 * the first pass: "i also wanted you to respect their uses by their names".
 * He is right, and two of the mistakes were the same mistake:
 *
 *   * **The laurel is for quests.** It went on every trophy, award and
 *     medal, so a game badge - which has its own icon and always had -
 *     started wearing the quest wreath. It is not in this table at all now;
 *     a quest asks for it by name.
 *   * **A stroke is a state, not a style.** `favourite-stroke`,
 *     `thumbs-up-stroke`, `thumbs-down-stroke` and `laurel-quest-stroke`
 *     exist because the filled one means *you pressed it*. Mapping `star`
 *     to the filled drawing made every star on the site look starred. They
 *     are out of this table too, and `on` below is how a call site that has
 *     the state asks for the right one.
 *
 * The people icons are the vocabulary Staw set out, one word each:
 *
 *   add-user     wanting to add somebody
 *   check-user   friends already
 *   remove-user  unfriending, or taking off best friend
 *   heart-user   best friend
 *   cross-user   turning a request down
 *   search-user  looking for people
 *   voice-user   voice chat
 *   users        your friends
 *   people       people in general, and communities
 */
const OURS: Record<string, KobIcon> = {
  // one person, and the people vocabulary
  user: 'user',
  'circle-user': 'circle-user',
  'user-large': 'user',
  'user-group': 'users',
  users: 'people',
  'user-plus': 'add-user',
  'user-minus': 'remove-user',
  'user-slash': 'remove-user',
  'user-xmark': 'cross-user',
  'user-check': 'check-user',
  'user-shield': 'admin',
  'user-tie': 'admin',

  // talking
  comment: 'chatbubble',
  comments: 'chatbubble',
  'comment-dots': 'chatbubble',
  message: 'chatbubble',
  'paper-plane': 'send',
  microphone: 'microphone',
  'microphone-slash': 'mute-microphone',
  'microphone-lines': 'microphone',
  bullhorn: 'announcement',

  // the rest
  flag: 'report',
  bell: 'notification',
  gear: 'gear',
  'circle-check': 'checkmark',
  percent: 'discount',
  /* Money on this site is Brix and has its own mark; `faCoins` on a menu
     entry or a record card means Brix and nothing else. */
  coins: 'brix',
  'hand-pointer': 'click',
  /* Staw: "for worlds, the world svg icon should be this image [...] and
     for assets its the second one". `faEarthEurope` is the mark a World
     wears everywhere (`worldIcon` in `@/lib/naming`) and `faShapes` is what
     the marketplace is drawn with, so both are his drawings now wherever
     they appear - rail, search, Create, the boards. */
  'earth-europe': 'world',
  shapes: 'assets',

  /*
   * Deliberately absent, each for a reason:
   *
   *   star, heart, thumbs-up, thumbs-down   a state, see `on`
   *   trophy, award, medal                  the laurel is quests only
   *   tag                                   a tag is a price, `discount`
   *                                         is a sale, and a shop must not
   *                                         say the wrong one
   */
}

/**
 * The four Staw drew twice: pressed, and not pressed.
 *
 * A call site that knows whether it is on asks with `on`; one that does not
 * know gets nothing from this table and keeps its Font Awesome glyph, which
 * is the honest outcome - an icon that claims a state it has not been told
 * about is worse than a borrowed one.
 */
const PRESSED: Record<string, { on: KobIcon; off: KobIcon }> = {
  star: { on: 'favourite', off: 'favourite-stroke' },
  heart: { on: 'favourite', off: 'favourite-stroke' },
  'thumbs-up': { on: 'thumbs-up', off: 'thumbs-up-stroke' },
  'thumbs-down': { on: 'thumbs-down', off: 'thumbs-down-stroke' },
}

export function Glyph({
  icon, name, on, tone = 'currentColor', label, title, style, spin, className,
}: {
  icon: IconDefinition
  /**
   * Name one of ours outright, for a place where the Font Awesome icon
   * standing in for it means something else everywhere else.
   *
   * The avatar page is the case: its glyph is a shirt, and `shirt` cannot
   * map to `avatar` globally because thirty-seven other shirts on this site
   * are shirts. So that one call site says which it wants.
   */
  name?: KobIcon
  /**
   * Whether the thing this icon stands for is switched on, for the four
   * Staw drew twice - a star, a heart, a thumb up, a thumb down.
   *
   * Left out, those four stay Font Awesome's, because the filled drawing
   * means "you pressed it" and showing it to somebody who has not is a lie
   * the page tells about them.
   */
  on?: boolean
  /**
   * What colour ours is painted. `currentColor` by default, so it behaves
   * like the glyph it replaced. `null` draws it as Staw drew it, colours
   * and all, which is what the Workspace's icons want.
   */
  tone?: string | null
  label?: string
  /*
   * The three Font Awesome props call sites in this repository actually
   * pass. Taken rather than refused, because the point of this component
   * is that `<FontAwesomeIcon>` can become `<Glyph>` without reading the
   * line first - a stand-in that drops a prop silently is worse than no
   * stand-in at all.
   */
  title?: string
  style?: React.CSSProperties
  spin?: boolean
  className?: string
}) {
  const both = PRESSED[icon.iconName as string]
  const mine = name ?? (both
    ? (on === undefined ? undefined : (on ? both.on : both.off))
    : OURS[icon.iconName as string])

  if (mine) {
    return (
      <Icon
        name={mine}
        label={label}
        title={title}
        style={style}
        tone={tone}
        className={cn(spin && 'animate-spin', className)}
      />
    )
  }

  return (
    <FontAwesomeIcon
      icon={icon}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      title={title}
      /* Font Awesome's `style` is narrower than React's; the cast is to its
         own CSS-variable type and not a loosening of anything. */
      style={style as React.ComponentProps<typeof FontAwesomeIcon>['style']}
      spin={spin}
      className={cn(className)}
    />
  )
}

/** Whether we have drawn this one ourselves, for anything that needs to ask. */
export const isOurs = (icon: IconDefinition) =>
  Boolean(OURS[icon.iconName as string] || PRESSED[icon.iconName as string])
