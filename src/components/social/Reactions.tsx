import { useEffect, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faFaceSmile, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Icon } from '@/components/brand/Icon'
import { Tooltip } from '@/components/ui/Tooltip'
import { useToast } from '@/components/ui/Toast'
import { FACES, react, type Face, type ReactionCount } from '@/lib/api'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * The ten faces, on a post or on a World.
 *
 * Staw: "Reactions are for announcements & posts, instead of simple
 * likes/dislikes while worlds keep the dislikes & likes only, but klub
 * users can also click a third button to add reactions to worlds".
 *
 * So the same control in both places, and the difference is what is
 * around it: on a post it is the whole of what you can say, and on a
 * World it sits beside a rating it does not touch.
 *
 * What is drawn is only the faces somebody actually pressed, plus the
 * button that opens the rest. A row of ten zeroes is ten things to read
 * with no information in any of them - and it is also a row that tells
 * everybody which faces exist before anybody has used one.
 *
 * It counts optimistically and then asks. A reaction that takes a round
 * trip to light up is a reaction nobody presses twice, and the server's
 * answer replaces the guess rather than being merged with it: if the two
 * disagree the server is right, which is the only rule that keeps a count
 * from drifting over an evening.
 */
export function Reactions({
  what, which, counts, canReact = true, whyNot, onChanged, className,
}: {
  what: 'post' | 'world'
  which: string
  /** What the page already knows, so a wall does not ask once per post. */
  counts: ReactionCount[]
  /**
   * Whether this person may react at all. A World is a Klub thing, and
   * `whyNot` is what the button says instead of pretending to work.
   */
  canReact?: boolean
  whyNot?: string
  onChanged?: () => void
  className?: string
}) {
  const say = useToast()
  const [shown, setShown] = useState<ReactionCount[]>(counts)
  const [picking, setPicking] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  /*
   * The page's answer wins whenever it changes. Held in state only so a
   * press can show before the server has agreed to it.
   */
  useEffect(() => setShown(counts), [counts])

  useEffect(() => {
    if (!picking) return
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setPicking(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setPicking(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [picking])

  const mine = shown.find((one) => one.mine)?.face ?? null

  const press = async (face: Face) => {
    if (!canReact) {
      if (whyNot) say(whyNot, 'info')
      return
    }
    setPicking(false)

    /*
     * The guess. One face per person, so pressing a new one takes the old
     * one off in the same breath - which is what the server does, and the
     * count has to agree with that or it reads as two reactions from one
     * person for a second.
     */
    const taking = mine === face
    setShown((had) => {
      let next = had.map((one) => (
        one.face === mine ? { ...one, how_many: one.how_many - 1, mine: false } : one
      ))
      if (!taking) {
        next = next.some((one) => one.face === face)
          ? next.map((one) => (
            one.face === face ? { ...one, how_many: one.how_many + 1, mine: true } : one
          ))
          : [...next, { face, how_many: 1, mine: true }]
      }
      return next.filter((one) => one.how_many > 0)
    })

    try {
      await react(what, which, face)
      onChanged?.()
    } catch (error) {
      // The guess was wrong, so it goes back to what the page knows.
      setShown(counts)
      say(error instanceof Error ? error.message : 'That did not go through.', 'error')
    }
  }

  return (
    <div ref={box} className={cn('relative flex flex-wrap items-center gap-1.5', className)}>
      {shown.map((one) => (
        <button
          key={one.face}
          type="button"
          onClick={() => void press(one.face)}
          aria-pressed={one.mine}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors',
            one.mine
              ? 'border-brand bg-brand/15 text-white'
              : 'border-ink-line bg-ink-raised text-white/70 hover:text-white',
          )}
        >
          <Icon name={`reaction-${one.face}`} className="h-4 w-4" />
          {formatCount(one.how_many)}
        </button>
      ))}

      <Tooltip label={canReact ? 'React' : (whyNot ?? 'You cannot react to this')} side="top">
        <button
          type="button"
          onClick={() => (canReact ? setPicking((v) => !v) : whyNot && say(whyNot, 'info'))}
          aria-label="React"
          aria-expanded={picking}
          className={cn(
            'inline-flex items-center gap-1 rounded-full border border-ink-line bg-ink-raised px-2.5 py-1 text-xs text-white/60 transition-colors',
            canReact ? 'hover:text-white' : 'opacity-50',
          )}
        >
          <Glyph icon={faFaceSmile} />
          <Glyph icon={faPlus} className="text-[9px]" />
        </button>
      </Tooltip>

      {picking && (
        /*
         * Above the button, because these sit at the bottom of a card and
         * a tray that opens downwards opens off the end of it.
         */
        <div className="absolute bottom-full left-0 z-30 mb-1.5 flex gap-0.5 rounded-2xl border border-ink-line bg-ink-card p-1.5 shadow-pop">
          {FACES.map((face) => (
            <button
              key={face}
              type="button"
              onClick={() => void press(face)}
              aria-label={face.replace('-', ' ')}
              className={cn(
                'grid h-9 w-9 place-items-center rounded-xl transition-transform hover:scale-110',
                mine === face && 'bg-brand/20',
              )}
            >
              <Icon name={`reaction-${face}`} className="h-6 w-6" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
