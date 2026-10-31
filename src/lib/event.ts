/**
 * The one thing Kobblon is running right now, for the banner on Home.
 *
 * A file rather than a table, and that is a decision rather than a
 * shortcut. There is one of these at a time, Staw sets it, and a table
 * would need a staff screen to edit it, a policy to guard it and a read on
 * every page load - which is a lot of platform for a sentence and a link.
 * When there are several at once, or somebody other than Staw sets them,
 * it becomes a table and this file becomes the fallback.
 *
 * What it must never do is outlive the thing it is about. A Halloween
 * banner still sitting on the homepage in December is worse than no banner
 * at all, so `until` hides it on its own. When a run has no end date yet,
 * `until` is null and the banner stays until it is taken out by hand -
 * said out loud here because that is the case that rots.
 */
export type PlatformEvent = {
  /** What it is called, as the banner's heading. */
  name: string
  /** One line about it. */
  blurb: string
  /** Where the banner goes. The forum category for it, or a World. */
  to: string
  /** What the button says. */
  action: string
  /** The small word over the name: "Contest", "Event". */
  tag: string
  /**
   * What is being given away, biggest first. Drawn as Brix chips.
   *
   * Empty where there is nothing to win, and the row is then not drawn -
   * three empty chips under an event with no prize is furniture.
   */
  prizes: { place: string; brix: number }[]
  /**
   * The day after the last day, as `YYYY-MM-DD`. The banner is gone from
   * then on. Null means nobody has set an end yet.
   */
  until: string | null
}

/*
 * Halloween 2026.
 *
 * Staw: "halloween avatar contest (prize: 10k brix for first place, 5k for
 * second, 2.5k for third)". The link is the forum category 0313 makes,
 * because that is the one place that exists today and will still exist
 * when the Discord event is over - he can point it at a Kobblon event
 * instead by changing `to` and nothing else.
 *
 * Ten days, starting the 31st of October 2026 - Staw: "the contest will
 * last 10 days starting today". So the last day anybody can enter is the
 * 9th of November and `until` is the 10th, the day the banner is gone.
 * One day out either way is a promise the page would be making on his
 * behalf, so it is written as the day after the last day and the
 * comparison below is strictly less than.
 */
export const RUNNING: PlatformEvent | null = {
  tag: 'Avatar contest',
  name: 'Halloween 2026',
  blurb: 'Put together the best Halloween avatar you can and post it. The three best take Brix.',
  to: '/forum/c/avatar-contest-halloween-2026',
  action: 'Enter the contest',
  prizes: [
    { place: '1st', brix: 10_000 },
    { place: '2nd', brix: 5_000 },
    { place: '3rd', brix: 2_500 },
  ],
  until: '2026-11-10',
}

/** The event to draw today, or nothing. */
export function eventNow(today = new Date()): PlatformEvent | null {
  if (!RUNNING) return null
  if (!RUNNING.until) return RUNNING
  return today.toISOString().slice(0, 10) < RUNNING.until ? RUNNING : null
}
