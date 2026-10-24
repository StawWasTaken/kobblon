import { useEffect, useState } from 'react'

/*
 * Whether a breakpoint is being met, asked live.
 *
 * `hidden lg:block` is a picture, not an absence: the thing is still
 * mounted, its effects still run, and its subscriptions are still open -
 * it simply is not painted. That is fine for a heading and expensive for a
 * panel that opens a channel, and on a phone it cost two of them.
 *
 * The rail is drawn twice there: the fixed one, hidden, and the one in the
 * drawer. Both ask for the friend-request count and the unread post, and
 * both open a channel named after the person, so the second copy joins a
 * topic the first is already in. The chat is the same shape - the docked
 * windows are `hidden md:flex` and the sheet is `md:hidden`, and opening a
 * conversation on a phone deliberately set both, so one conversation was
 * two mounted windows on one channel, each marking the same messages read.
 *
 * So the breakpoint is a value rather than a class, where what is behind
 * the class is live. Asked as a query with a listener, not read once:
 * turning the phone sideways has to change the answer, which is the trap
 * this project keeps falling into and which the one-line read in
 * `openConversation` was already an instance of.
 */
export function useMedia(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setMatches(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** Tailwind's `lg`: where the rail stops being a drawer. */
export const useWide = () => useMedia('(min-width: 1024px)')

/** Tailwind's `md`: where the chat stops being a sheet and becomes windows. */
export const useNarrow = () => useMedia('(max-width: 767px)')
