/*
 * Marks that sit on top of a picture.
 *
 * A picture can be any colour and so can the page, so these are built out of
 * the theme's own card colour rather than out of black: in the dark they are
 * dark, in the light they are light, and either way a blur and a hairline
 * edge keep them legible over whatever is underneath. A black pill on a light
 * page reads as a hole punched in it.
 */
export const overlayChip =
  'rounded-lg bg-ink-card/80 px-1.5 py-0.5 text-mark font-extrabold uppercase '
  + 'tracking-wide text-white ring-1 ring-ink-line backdrop-blur'

export const overlayButton =
  'grid place-items-center rounded-lg bg-ink-card/80 text-white ring-1 ring-ink-line '
  + 'backdrop-blur transition-colors hover:bg-ink-hover'
