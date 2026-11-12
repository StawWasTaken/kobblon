/** Marks a gap in a conversation, so a reply hours later does not read as a reply. */
export function TimeSeparator({ at }: { at: string }) {
  const when = new Date(at)
  const today = new Date()
  const sameDay = when.toDateString() === today.toDateString()

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const wasYesterday = when.toDateString() === yesterday.toDateString()

  const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  const label = sameDay
    ? time
    : wasYesterday
      ? `Yesterday ${time}`
      : `${when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${time}`

  return (
    <div className="flex items-center gap-3 py-2" role="separator">
      <span className="h-px flex-1 bg-ink-line" />
      <span className="text-tiny font-semibold uppercase tracking-wide text-white/35">
        {label}
      </span>
      <span className="h-px flex-1 bg-ink-line" />
    </div>
  )
}
