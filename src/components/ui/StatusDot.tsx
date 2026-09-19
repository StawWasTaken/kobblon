import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faHouse, faHammer, faMinus } from '@fortawesome/free-solid-svg-icons'
import { asset } from '@/lib/asset'
import { cn } from '@/lib/cn'

/**
 * Presence, in four states that never share a colour or a mark.
 *
 * Blue and the Kobblon mark: on Kobblon. Green and a house: inside a
 * Space, which is the colour Spaces always get. Orange and a hammer: building
 * something. Grey and a dash: not here.
 *
 * Anybody who has not said anything for a few minutes is treated as gone,
 * whatever their flag says, so a browser closed mid-sentence does not leave
 * somebody lit up for ever.
 */
export type Presence = 'online' | 'in-space' | 'building' | 'offline'

const tone: Record<Presence, string> = {
  online: 'bg-brand-bright text-[#fff]',
  'in-space': 'bg-space text-[#fff]',
  building: 'bg-[#FFB020] text-[#2a1a00]',
  offline: 'bg-[#8A8A94] text-[#20202a]',
}

export const presenceWords: Record<Presence, string> = {
  online: 'Online',
  'in-space': 'In a World',
  building: 'Building',
  offline: 'Offline',
}

/**
 * Every dot is the same dot: one size chart, one set of marks, and the mark
 * is always there. The smallest is twelve pixels because that is the smallest
 * a mark inside a circle still reads at.
 */
const sizes = {
  sm: 'h-3 w-3 text-[6px]',
  md: 'h-3.5 w-3.5 text-[7px]',
  lg: 'h-4 w-4 text-[8px]',
  xl: 'h-5 w-5 text-[10px]',
  '2xl': 'h-7 w-7 text-[13px]',
}

/** How long somebody can be quiet before they count as gone. */
const GONE_AFTER = 3 * 60 * 1000

export function presenceOf(p?: {
  is_online?: boolean
  in_space_id?: string | null
  activity?: string | null
  last_seen_at?: string | null
} | null): Presence {
  if (!p?.is_online) return 'offline'

  // The flag is only worth believing while it is fresh.
  if (p.last_seen_at && Date.now() - new Date(p.last_seen_at).getTime() > GONE_AFTER) {
    return 'offline'
  }

  if (p.in_space_id) return 'in-space'
  if (p.activity === 'building') return 'building'
  return 'online'
}

function Mark({ presence }: { presence: Presence }) {
  // The house mark is ours, so it is the logo rather than a shape that looks
  // like it. It is flattened to white because a dot is one colour and a mark
  // on it is the other.
  if (presence === 'online') {
    return (
      <img
        src={asset('/brand/logomark.png')}
        alt=""
        className="h-[1.15em] w-[1.15em] brightness-0 invert"
      />
    )
  }
  if (presence === 'in-space') return <FontAwesomeIcon icon={faHouse} />
  if (presence === 'building') return <FontAwesomeIcon icon={faHammer} />
  return <FontAwesomeIcon icon={faMinus} />
}

export function StatusDot({
  presence,
  size = 'md',
  ring,
  className,
  // Whatever is put on it from outside, so a tooltip can hand it the handlers
  // it needs without a wrapper getting between the dot and its corner.
  ...rest
}: {
  presence: Presence
  size?: keyof typeof sizes
  ring?: boolean
  className?: string
} & React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      {...rest}
      className={cn(
        'inline-grid place-items-center rounded-full leading-none',
        tone[presence],
        sizes[size],
        // The ring is the page behind it, so the dot reads as sitting on the
        // edge of a picture rather than floating over it.
        ring && 'ring-[3px] ring-ink',
        className,
      )}
      role="img"
      aria-label={presenceWords[presence]}
    >
      <Mark presence={presence} />
    </span>
  )
}

export function PresenceLabel({ presence }: { presence: Presence }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <StatusDot presence={presence} size="md" />
      {presenceWords[presence]}
    </span>
  )
}
