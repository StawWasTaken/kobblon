/**
 * What things are called.
 *
 * Kobblon renamed its currency once and it cost one file, because the word
 * lived in one place. The same applies to the thing people make: it was a
 * Space, it is a World now, and if it is ever called something else that is
 * a change here rather than a change in four hundred places.
 *
 * Use these in anything a person reads. Code identifiers are allowed to lag:
 * a variable called `spaceId` is nobody's problem, a button that says the
 * wrong word is.
 */
/**
 * The mark a World wears, everywhere.
 *
 * Europe rather than the Atlantic: a globe turned to the middle of an ocean
 * with the Americas on it says something about where a site thinks it is,
 * every time it appears, and Kobblon is not an American site.
 */
export { faEarthEurope as worldIcon } from '@fortawesome/free-solid-svg-icons'

export const world = {
  one: 'World',
  many: 'Worlds',
  /** Lower case, for the middle of a sentence. */
  lower: 'world',
  lowerMany: 'worlds',
  /** The verb for going into one. */
  enter: 'Play',
  /** What somebody who makes them is doing. */
  making: 'building',
  /** The address they live at, so links and copy cannot disagree. */
  path: 'worlds',
} as const

/**
 * The old 2D Spaces, which are not Worlds and are not coming back.
 *
 * They are kept so nobody's work vanishes and so old links answer. Anywhere
 * one is shown, it is shown as what it is: an archive.
 */
export const classic = {
  one: 'classic Space',
  many: 'classic Spaces',
  note: 'An old Kobblon Space. These were 2D pages, and they are no longer built or played.',
} as const
