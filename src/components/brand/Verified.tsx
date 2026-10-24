import { Tooltip } from '@/components/ui/Tooltip'
import { useNameMarks } from '@/hooks/useNameMarks'
import { cn } from '@/lib/cn'

/*
 * The two marks that belong to a name.
 *
 * Staw's rule, and it is about meaning rather than decoration: a mark is
 * **part of the display name**, not an ornament beside it. Wherever a name
 * is written - a profile, a card, "made by @somebody", a message, a list -
 * the mark goes with it, and a place that writes the name without it is
 * writing a different name.
 *
 * Both are Kobblon's own artwork, and never Font Awesome's tick. They are
 * drawn as a CSS mask over `currentColor` rather than as an `<img>`: the
 * files are a solid badge with the glyph knocked out of it, so masking gives
 * the badge the colour of whatever it sits in and lets the glyph show the
 * surface behind - which is what makes it read at twelve pixels beside a
 * name. An `<img>` would be a white square, and tracing them into paths
 * again would be a copy that drifts from the artwork.
 */
const MARKS = {
  verified: '/brand/verified.png',
  staff: '/brand/staff.png',
} as const

function Mark({ which, className }: { which: keyof typeof MARKS; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-[1em] w-[1em] align-[-0.125em] bg-current', className)}
      style={{
        maskImage: `url(${MARKS[which]})`,
        WebkitMaskImage: `url(${MARKS[which]})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  )
}

/** The tick on its own, for a caller that is drawing its own surround. */
export const VerifiedMark = ({ className }: { className?: string }) =>
  <Mark which="verified" className={className} />

/** The Kobblon k, which is what staff carry. */
export const StaffMark = ({ className }: { className?: string }) =>
  <Mark which="staff" className={className} />

/**
 * Whether somebody's name should carry the tick. Being staff implies it;
 * being verified does not imply being staff.
 */
export const isVerified = (person?: {
  is_verified?: boolean | null
  is_admin?: boolean | null
  is_superadmin?: boolean | null
} | null) => !!(person?.is_verified || person?.is_admin || person?.is_superadmin)

/**
 * Whether somebody's name should carry the k.
 *
 * Three ways to wear it and they are not the same thing: the badge is a
 * mark somebody was given and carries no permission, while admin and
 * moderator are power that brings the mark with it. The database answers
 * this with `wears_staff_badge`; this is the same rule for a row already in
 * hand, and the two must say the same thing.
 */
export const isStaff = (person?: {
  is_admin?: boolean | null
  is_moderator?: boolean | null
  is_superadmin?: boolean | null
  has_staff_badge?: boolean | null
} | null) => !!(
  person?.is_admin || person?.is_moderator
  || person?.is_superadmin || person?.has_staff_badge
)

export function Verified({
  label = 'Verified by Kobblon',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <Tooltip label={label} side="top">
      <span className="inline-flex shrink-0 align-middle text-[#4d68ff]" aria-label={label}>
        <VerifiedMark className={className} />
      </span>
    </Tooltip>
  )
}

export function Staff({
  label = 'Kobblon staff',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <Tooltip label={label} side="top">
      <span className="inline-flex shrink-0 align-middle text-white" aria-label={label}>
        <StaffMark className={className} />
      </span>
    </Tooltip>
  )
}

/**
 * Everything that belongs after a name, in one place.
 *
 * Here so that "which marks does a name carry" is answered once. It was
 * answered at twenty-one call sites, each deciding for itself whether staff
 * counts as verified, and that is how one page ends up showing a tick where
 * another shows nothing for the same person.
 *
 * Pass `id` wherever one is in hand, which is almost everywhere. The row's
 * own flags are drawn immediately as a first guess so nothing arrives late,
 * and the database's answer replaces it the moment it lands - because the
 * guess is only ever as good as the columns that list happened to select,
 * and that is exactly what was wrong. With no `id` it stays a guess, which
 * is better than nothing and is said out loud here rather than hidden.
 */
export function NameMarks({ person, id, username, className }: {
  person?: {
    is_verified?: boolean | null
    is_admin?: boolean | null
    is_moderator?: boolean | null
    is_superadmin?: boolean | null
    has_staff_badge?: boolean | null
  } | null
  /** The person's account id, so the marks can be asked rather than guessed. */
  id?: string | null
  /** Their username, for the lists that carry that and not an id. */
  username?: string | null
  className?: string
}) {
  const said = useNameMarks(id, username)

  const wears = said ?? [
    isVerified(person) && 'verified',
    isStaff(person) && 'staff',
  ].filter(Boolean) as string[]

  const marks = [
    wears.includes('verified') && <Verified key="v" className={className} />,
    wears.includes('staff') && <Staff key="s" className={className} />,
  ].filter(Boolean)

  if (!marks.length) return null
  return <span className="inline-flex shrink-0 items-center gap-1 align-middle">{marks}</span>
}
