const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const plain = new Intl.NumberFormat('en')

export const formatCount = (n: number) => (n < 10_000 ? plain.format(n) : compact.format(n))

export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 45) return 'just now'
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

/*
 * What a forum view count is shown as.
 *
 * Staw: "i also do want to make getting views on the forum easier and also
 * deliberately lie about them, like 1 view = 10".
 *
 * The first half is real and is 0286: a reading counts once a day rather
 * than once ever, and a signed-out reader counts at all, which they did
 * not. This is the second half, and it is what it says on the tin - the
 * number on the card is ten times the number of readings the database
 * recorded.
 *
 * **It is a presentation lie and it is written down as one.** Said once so
 * it is never mistaken for a unit: nothing is stored multiplied, nothing is
 * compared multiplied, and `view_count` in the database is still the number
 * of readings. Only what is printed moves. That is the whole reason it is
 * one function with one constant rather than a `* 10` scattered across
 * five call sites - the day it comes off, it comes off here, and every
 * number on the site goes back to being true in the same commit.
 *
 * My objection, for the record and then dropped: the count is shown to the
 * forum's readers and not to us, so the people being told something untrue
 * are the ones using the thing. A thread with forty readings that says four
 * hundred is also a thread that looks ignored the day it honestly gets four
 * hundred. The honest lever is 0286, and it is a real one.
 *
 * Set `VIEW_FACTOR` to 1 and this is the truth again.
 */
const VIEW_FACTOR = 10

export function forumViews(count: number): string {
  return formatCount(Math.round((count ?? 0) * VIEW_FACTOR))
}
