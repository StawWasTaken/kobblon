/**
 * What Home says to you instead of saying "Home".
 *
 * Four times of day, two ways of saying each, so the page is not the same
 * sentence every morning. Which of the two shows is decided by the day
 * rather than by chance: a random one changes under you when a panel
 * re-renders, and a greeting that rewrites itself mid-sentence reads as a
 * bug. By the day it is settled for as long as you are looking at it, and
 * different the next time round.
 *
 * The Workspace shows the same thing over the same avatar, which is why
 * this is here rather than in a page: one copy, both windows, one voice.
 */
export type Greeting = { hello: string; aside: string }

const WHEN: { from: number; to: number; lines: [Greeting, Greeting] }[] = [
  {
    from: 5, to: 12,
    lines: [
      { hello: 'Good morning, %s!', aside: 'The servers are warm already.' },
      { hello: 'Morning, %s.', aside: 'Yum yum yum. Breakfast first, Worlds after.' },
    ],
  },
  {
    from: 12, to: 18,
    lines: [
      { hello: 'Good afternoon, %s!', aside: 'Plenty still going on out there.' },
      { hello: 'Hey, %s.', aside: 'Half the day left. Build something with it.' },
    ],
  },
  {
    from: 18, to: 23,
    lines: [
      { hello: 'Good evening, %s!', aside: 'The busiest hours on Kobblon.' },
      { hello: 'Evening, %s.', aside: 'Everybody is online. Go and find them.' },
    ],
  },
  {
    from: 23, to: 5,
    lines: [
      { hello: 'Still up, %s?', aside: 'The quiet Worlds are the good ones.' },
      { hello: 'Good night, %s.', aside: 'One more World and then bed.' },
    ],
  },
]

/** Which of the two, settled by the date so it holds while you read it. */
function whichOne(at: Date) {
  const day = Math.floor(at.getTime() / 86_400_000)
  return day % 2
}

export function greeting(name: string, at: Date = new Date()): Greeting {
  const hour = at.getHours()
  const slot = WHEN.find((one) => (
    one.from < one.to ? hour >= one.from && hour < one.to : hour >= one.from || hour < one.to
  )) ?? WHEN[0]
  const line = slot.lines[whichOne(at)]
  return { hello: line.hello.replace('%s', name), aside: line.aside }
}
