/**
 * Our k, as a glyph.
 *
 * Staw: "for the logomark i want you to use a completely white one that
 * you'll use as an svg icon (like the discord & youtube logos)".
 *
 * `Logomark` in `Wordmark` is the drawn mark - a picture, in Kobblon blue,
 * with a theme and a season behind it. That is the right thing at the top of
 * a page and the wrong thing in a list beside Discord and YouTube, where
 * every other mark is a monochrome glyph that takes the colour of the text
 * it sits in and brightens with it on hover. A blue picture in that row does
 * not do either: it stays blue when the line goes white, and it is drawn at
 * whatever size the file is rather than at the size of the line.
 *
 * So this is the same shape, traced off `public/brand/logomark.png` at its
 * own 109x175, as paths rather than pixels. It fills with `currentColor`,
 * which is what makes "completely white" true without a second white file to
 * keep in step with the blue one: it is white because the line is white.
 *
 * Sharp corners and flat edges on purpose - the mark has no curves in it,
 * and the three pieces are the stem, the two arms, and the bar with the
 * notch cut out of its right side.
 */
export function Kmark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 109 175"
      className={className}
      fill="currentColor"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
    >
      {title && <title>{title}</title>}
      {/* The stem. */}
      <path d="M1 0h41v175H1z" />
      {/* The upper arm, falling to meet the bar. */}
      <path d="M80 31h28v37H55z" />
      {/* The bar, with its notch. */}
      <path d="M42 68h66v10H70v20h38v10H42z" />
      {/* The lower arm, leaving the bar. */}
      <path d="M55 108h53v67H99z" />
    </svg>
  )
}
