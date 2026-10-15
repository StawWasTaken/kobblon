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

/** Font Awesome's name for a glyph, to the one Staw drew for it. */
const OURS: Record<string, KobIcon> = {
  // people
  user: 'user',
  'circle-user': 'circle-user',
  'user-large': 'user',
  users: 'users',
  'user-group': 'people',
  'user-plus': 'add-user',
  'user-minus': 'remove-user',
  'user-slash': 'remove-user',
  'user-xmark': 'cross-user',
  'user-check': 'check-user',
  'user-shield': 'admin',
  'user-tie': 'admin',
  'user-pen': 'search-user',
  'magnifying-glass-arrow-right': 'search-user',

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

  // saying yes and no about something
  'thumbs-up': 'thumbs-up',
  'thumbs-down': 'thumbs-down',
  star: 'favourite',
  heart: 'favourite',
  flag: 'report',
  bell: 'notification',
  gear: 'gear',
  'circle-check': 'checkmark',

  // money and shopping. `tag` deliberately stays Font Awesome's: a tag is
  // a price and `discount` is a sale, and an icon that says the wrong one
  // of those on a shop is worse than a borrowed glyph.
  percent: 'discount',

  // awards
  trophy: 'laurel-quest',
  award: 'laurel-quest',
  medal: 'laurel-quest',

  // pointing at things
  'hand-pointer': 'click',
}

export function Glyph({
  icon, tone = 'currentColor', label, title, style, spin, className,
}: {
  icon: IconDefinition
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
  const mine = OURS[icon.iconName as string]

  if (mine) {
    return (
      <Icon
        name={mine}
        label={label}
        title={title}
        style={style}
        tone={tone ?? undefined}
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
export const isOurs = (icon: IconDefinition) => Boolean(OURS[icon.iconName as string])
