import { Tooltip } from '@/components/ui/Tooltip'
import { useNameMarks } from '@/hooks/useNameMarks'
import { cn } from '@/lib/cn'

/*
 * The four marks that belong to a name.
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
/*
 * Staw: "we should of course get different colours for the guest, verified,
 * staff (& klub) badges to not confuse them."
 *
 * So each mark is a different glyph **and** a different colour, and no two
 * of them can be read as the same thing at twelve pixels. The colour lives
 * beside the artwork here rather than at the call sites, because the whole
 * point of this file is that the question is answered once.
 *
 *   verified  a tick      Kobblon blue   somebody is who they say they are
 *   staff     the k       white          they work here
 *   klub      a hard hat  gold           their Klub membership is running
 *   guest     an ID card  slate          they have not made the account real
 *
 * Guest is deliberately the quiet one. It is not an honour and it must not
 * look like one; it is a fact worth knowing before you trade with somebody.
 *
 * The Klub artwork is the icon set's `klub-badge`, which is already drawn
 * the right way - the glyph knocked out of a solid square - so it is used
 * where it sits rather than copied into `/brand` to drift from itself.
 */
const MARKS = {
  verified: { art: '/brand/verified.png', tone: 'text-[#4d68ff]', says: 'Verified by Kobblon' },
  staff: { art: '/brand/staff.png', tone: 'text-white', says: 'Kobblon staff' },
  klub: { art: '/icons/ui/klub-badge.png', tone: 'text-[#f5b32b]', says: 'In Klub Kobblon' },
  guest: { art: '/brand/guest.png', tone: 'text-[#8a93a8]', says: 'A guest account' },
} as const

export type MarkName = keyof typeof MARKS

function Mark({ which, className }: { which: MarkName; className?: string }) {
  const art = MARKS[which].art
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-[1em] w-[1em] align-[-0.125em] bg-current', className)}
      style={{
        maskImage: `url(${art})`,
        WebkitMaskImage: `url(${art})`,
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

/** The hard hat, for a Klub membership that is running today. */
export const KlubMark = ({ className }: { className?: string }) =>
  <Mark which="klub" className={className} />

/** The ID card, for an account that is still a guest. */
export const GuestMark = ({ className }: { className?: string }) =>
  <Mark which="guest" className={className} />

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

/**
 * One mark, in its own colour, with its own words under the pointer.
 *
 * Written once off the table above rather than as four near-identical
 * components, which is how the tick and the k ended up with their colours
 * typed into two different places to begin with.
 */
export function NameMark({ which, label, className }: {
  which: MarkName
  label?: string
  className?: string
}) {
  const mark = MARKS[which]
  const says = label ?? mark.says
  return (
    <Tooltip label={says} side="top">
      <span className={cn('inline-flex shrink-0 align-middle', mark.tone)} aria-label={says}>
        <Mark which={which} className={className} />
      </span>
    </Tooltip>
  )
}

export const Verified = (p: { label?: string; className?: string }) =>
  <NameMark which="verified" {...p} />

export const Staff = (p: { label?: string; className?: string }) =>
  <NameMark which="staff" {...p} />

export const Klub = (p: { label?: string; className?: string }) =>
  <NameMark which="klub" {...p} />

export const Guest = (p: { label?: string; className?: string }) =>
  <NameMark which="guest" {...p} />

/**
 * Everything that belongs after a name, in one place.
 *
 * Here so that "which marks does a name carry" is answered once. It was
 * answered at twenty-one call sites, each deciding for itself whether staff
 * counts as verified, and that is how one page ends up showing a tick where
 * another shows nothing for the same person.
 *
 * Pass `id` wherever one is in hand, or `username` where that is what the
 * list carries. One of the two is required in practice: with neither, there
 * is nobody to ask about and no marks are drawn.
 */
export function NameMarks({ id, username, className }: {
  person?: {
    is_verified?: boolean | null
    is_admin?: boolean | null
    is_moderator?: boolean | null
    is_superadmin?: boolean | null
    has_staff_badge?: boolean | null
    is_guest?: boolean | null
    membership?: string | null
  } | null
  /** The person's account id, so the marks can be asked rather than guessed. */
  id?: string | null
  /** Their username, for the lists that carry that and not an id. */
  username?: string | null
  className?: string
}) {
  const wears = useNameMarks(id, username)

  /*
   * **Only the database decides.** Staw: "id like to precise that for the
   * badges only refer to the database".
   *
   * There used to be a guess here, drawn from whatever flags the row in
   * hand happened to carry, so that nothing arrived late. It was wrong in
   * both directions and it was wrong visibly: a list that selects
   * `is_verified` but not the staff columns drew a tick on somebody who
   * also works here, a stale cached row kept a mark somebody had lost, and
   * the Klub could never show at all because only `in_the_klub` knows
   * whether a membership is still running. Four different pages could
   * therefore print four different sets of marks beside the same name.
   *
   * A mark is a claim about a person. A claim worth drawing is worth
   * asking for, so this asks, and draws nothing until it is answered -
   * `name_marks` is one round trip and it is cached per name. Nothing
   * missing for a moment is cheaper than something untrue.
   *
   * `person` is still accepted and deliberately ignored, so that the
   * hundred call sites passing it keep compiling and none of them can put
   * a mark on a name by handing this component a flag.
   */
  const marks = (['verified', 'staff', 'klub', 'guest'] as MarkName[])
    .filter((which) => wears?.includes(which))
    .map((which) => <NameMark key={which} which={which} className={className} />)

  if (!marks.length) return null
  return <span className="inline-flex shrink-0 items-center gap-1 align-middle">{marks}</span>
}
