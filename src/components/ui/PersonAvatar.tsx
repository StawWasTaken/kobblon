import { PresenceLabel, StatusDot, presenceWords } from '@/components/ui/StatusDot'
import { Avatar } from '@/components/ui/Avatar'
import { Tooltip } from '@/components/ui/Tooltip'
import { useLivePresence } from '@/hooks/usePresenceStore'
import { avatarOf } from '@/lib/avatars'
import { cn } from '@/lib/cn'

type Somebody = {
  id?: string
  display_name: string
  /** What they have on: drawn over the picture, wherever it appears. */
  avatar_url?: string | null
  /** When they last changed how they look, so an old picture is redrawn. */
  avatar_changed_at?: string | null
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
}

const sizes = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
  '2xl': 'h-20 w-20',
  '3xl': 'h-32 w-32',
}

/**
 * One chart for the whole site: how big the dot is beside how big the face
 * is. It was different in every place before, which is why no two of them
 * looked alike.
 */
const dots: Record<keyof typeof sizes, 'sm' | 'md' | 'lg' | 'xl' | '2xl'> = {
  xs: 'sm', sm: 'sm', md: 'md', lg: 'md', xl: 'lg', '2xl': 'xl', '3xl': '2xl',
}

/**
 * Somebody's picture with the dot on it, which is the only way either should
 * ever appear.
 *
 * The dot sits on the edge of the picture, half on and half off, the way it
 * does everywhere people already know it from, and says what it means when
 * you rest on it. A round picture needs it pushed in towards the corner,
 * because the corner of a circle is empty; a square one takes the corner
 * itself.
 */
/** The words for somebody's state, kept live the same way the dot is. */
export function LivePresenceLabel({ person }: { person: Parameters<typeof useLivePresence>[0] }) {
  return <PresenceLabel presence={useLivePresence(person)} />
}

export function PersonAvatar({
  person, size = 'md', square, className, ring = 'ring-ink', frame, overlay,
}: {
  person: Somebody | null | undefined
  size?: keyof typeof sizes
  /** Square pictures are used where a tile reads better than a circle. */
  square?: boolean
  className?: string
  /** What the dot is cut out of: whatever the picture sits on. */
  ring?: string
  /** A ring of somebody's own colour, on their own page. */
  frame?: string
  /** Something drawn over the picture, under the dot. */
  overlay?: React.ReactNode
}) {
  /*
   * One place decides what somebody's dot says, and it changes while you are
   * looking at it. A row fetched by a page is only the fallback, for people
   * who are not here to speak for themselves.
   */
  const presence = useLivePresence(person)

  return (
    <span className={cn('relative inline-block shrink-0', sizes[size], className)}>
      {/* Anything worn behind goes under the picture; the picture itself is
          clipped to its shape, and anything worn in front sits over the lot
          without being cut off by that shape. */}

      <span
        className={cn('relative block h-full w-full', square ? 'rounded-xl' : 'rounded-full')}
        style={frame ? { boxShadow: frame } : undefined}
      >
        <Avatar
          src={avatarOf(person ?? undefined)}
          personId={person?.id}
          changedAt={person?.avatar_changed_at}
          name={person?.display_name ?? '?'}
          size="md"
          className={cn('h-full w-full', square ? 'rounded-xl' : 'rounded-full')}
        />
        {overlay}
      </span>


      <Tooltip label={presenceWords[presence]} side="top">
        <StatusDot
          presence={presence}
          size={dots[size]}
          className={cn(
            // Over whatever else is on the picture, and never see through.
            'absolute z-10 cursor-default',
            square
              ? '-bottom-0.5 -right-0.5'
              : 'bottom-[7%] right-[7%] translate-x-[18%] translate-y-[18%]',
            'ring-[3px]',
            ring,
          )}
        />
      </Tooltip>
    </span>
  )
}
