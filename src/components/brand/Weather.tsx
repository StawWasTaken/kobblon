import { useMemo } from 'react'
import { useAppearance } from '@/hooks/useAppearance'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { LOOKS } from '@/lib/appearances'

/**
 * A little falling something, on some pages, some of the time.
 *
 * Staw: "for both halloween & christmas appearances sometimes theres
 * effects around the website, like idk some snow falling stuff but not that
 * much either, just sometime and somewhere".
 *
 * So: not much, and not everywhere. Eighteen pieces, mounted by the pages
 * that have room for it rather than by the shell, and skipped entirely for
 * anybody who has asked their machine for less movement. It draws behind
 * everything and takes no pointer events, so it can never be the reason
 * something cannot be clicked.
 *
 * The pieces are placed with a seed worked out once per mount, which is
 * what makes it "sometimes somewhere": two pages do not get the same fall,
 * and the same page does not get the same one twice.
 *
 * One thing to know before moving it: a piece falls `105vh`, so it wants a
 * box the height of the window. Inside a short one they leave the top and
 * are never seen again, which looks like the animation is broken rather
 * than like what it is.
 */
const HOW_MANY = 18

export function Weather({ className, falling }: {
  className?: string
  /**
   * Draw this whatever is being worn. Only the bare page under
   * `tools/site/` passes it, so the fall can be looked at in July.
   */
  falling?: 'snow' | 'leaves'
}) {
  const { appearance } = useAppearance()
  const still = useReducedMotion()
  const kind = falling ?? LOOKS[appearance]?.weather

  const pieces = useMemo(
    () => Array.from({ length: HOW_MANY }, () => ({
      left: Math.random() * 100,
      delay: Math.random() * 12,
      fall: 9 + Math.random() * 9,
      size: 8 + Math.random() * 10,
      drift: Math.random() * 40 - 20,
      spin: Math.random() * 360,
    })),
    [],
  )

  if (!kind || still) return null

  return (
    <div
      aria-hidden
      className={className ?? 'pointer-events-none absolute inset-0 -z-10 overflow-hidden'}
    >
      {pieces.map((piece, nth) => (
        <span
          key={nth}
          className="kob-falls absolute top-0 select-none leading-none"
          style={{
            left: `${piece.left}%`,
            fontSize: `${piece.size}px`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.fall}s`,
            ['--drift' as string]: `${piece.drift}px`,
            ['--spin' as string]: `${piece.spin}deg`,
          }}
        >
          {kind === 'snow' ? '❄' : '🍂'}
        </span>
      ))}
    </div>
  )
}
