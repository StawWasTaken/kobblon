import { useEffect, useRef, useState } from 'react'
import { Glyph } from '@/components/brand/Glyph'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
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
 * **Three each.** It was one, and the one-per-person rule lived in the
 * table's primary key; migration 0242 widened that key and the server
 * refuses a fourth. Nothing is swapped out to make room: a press that
 * cannot be kept says so, because a face that vanished on its own is a bug
 * nobody can explain to themselves.
 *
 * What is drawn is only the faces somebody actually pressed, plus the
 * button that opens the rest. A row of ten zeroes is ten things to read
 * with no information in any of them - and it is also a row that tells
 * everybody which faces exist before anybody has used one.
 *
 * **The faces are drawn as drawn, in colour when they are yours.** Staw
 * picked the colours: #FFCC4D for all of them, which is the yellow an
 * emoji face is, except the skull in bone grey and the angry one in red.
 * The bone is a token rather than a number, because #E6E7E8 is a skull on
 * a dark card and an empty space on a white one - Staw, of the light
 * theme: "for the reactions on light stuff its- uh weird". The yellow and
 * the red hold in both and are left exactly as he set them.
 * Not yours, they take the colour of the text around them like every other
 * icon on the site - so an unpressed face is quiet and a pressed one is
 * the only coloured thing in the row, which is the whole job.
 *
 * It counts optimistically and then asks. A reaction that takes a round
 * trip to light up is a reaction nobody presses twice, and the server's
 * answer replaces the guess rather than being merged with it: if the two
 * disagree the server is right, which is the only rule that keeps a count
 * from drifting over an evening.
 */
/**
 * What colour a face is when it is yours. Staw's numbers.
 *
 * One yellow for the lot, because they are one set and a set that is nine
 * colours is nine things rather than a set - except the two that would be
 * saying the wrong thing in it: a yellow skull is a smiley with no face
 * and a yellow angry face is not angry.
 */
const FACE_YELLOW = '#FFCC4D'

const FACE_COLOUR: Record<Face, string> = {
  smile: FACE_YELLOW,
  laugh: FACE_YELLOW,
  'happy-grin': FACE_YELLOW,
  'winky-grin': FACE_YELLOW,
  'heart-eyes': FACE_YELLOW,
  sunglasses: FACE_YELLOW,
  shocked: FACE_YELLOW,
  sad: FACE_YELLOW,
  angry: '#DF1F2D',
  skull: 'rgb(var(--face-bone))',
}

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

  /*
   * Up to three, which is Staw's number and the server's rule. The page
   * counts them so the tray can say when it is full rather than letting
   * somebody press a fourth and be told off for it.
   */
  const mine = shown.filter((one) => one.mine).map((one) => one.face)
  const full = mine.length >= 3

  const press = async (face: Face) => {
    if (!canReact) {
      if (whyNot) say(whyNot, 'info')
      return
    }
    setPicking(false)

    /*
     * The guess. Each face stands on its own now: pressing one adds it,
     * pressing it again takes it off, and three is as many as the server
     * will keep. Nothing is taken off to make room - a fourth press is
     * refused rather than quietly replacing the oldest, because a face
     * disappearing on its own is a bug nobody can explain to themselves.
     */
    const taking = mine.includes(face)
    if (!taking && full) {
      say('Three faces is as much as anybody can say about one thing.', 'info')
      return
    }

    setShown((had) => {
      const next = had.some((one) => one.face === face)
        ? had.map((one) => (one.face === face
          ? { ...one, how_many: one.how_many + (taking ? -1 : 1), mine: !taking }
          : one))
        : [...had, { face, how_many: 1, mine: true }]
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
            'inline-flex items-center gap-2 rounded-full border py-1.5 pl-2 pr-3.5 text-base font-bold transition-transform duration-150 hover:scale-105 active:scale-95',
            one.mine
              ? 'border-brand bg-brand/15 text-white'
              : 'border-ink-line bg-ink-raised text-white/70 hover:text-white',
          )}
        >
          <Icon
            name={`reaction-${one.face}`}
            tone={one.mine ? FACE_COLOUR[one.face] : undefined}
            className="h-7 w-7"
          />
          {formatCount(one.how_many)}
        </button>
      ))}

      <Tooltip
        label={canReact
          ? (full ? 'Three is the most. Press one again to take it off.' : 'React')
          : (whyNot ?? 'You cannot react to this')}
        side="top"
      >
        <button
          type="button"
          onClick={() => (canReact ? setPicking((v) => !v) : whyNot && say(whyNot, 'info'))}
          aria-label="React"
          aria-expanded={picking}
          className={cn(
            'inline-flex items-center gap-0.5 rounded-full border border-ink-line bg-ink-raised py-1.5 pl-2 pr-2.5 transition-transform duration-150 hover:scale-105 active:scale-95',
            canReact ? 'text-white/60 hover:text-white' : 'text-white/40 opacity-60',
          )}
        >
          {/*
            * Staw's smiling face, not Font Awesome's - "for the faces svg
            * icon use the reaction smiling instead of a smiley". In its own
            * yellow, because this button is the one that says "there are
            * faces here" and a grey one says the opposite.
            */}
          <Icon name="reaction-smile" tone={canReact ? FACE_YELLOW : undefined} className="h-7 w-7" />
          <Glyph icon={faPlus} className="text-[11px]" />
        </button>
      </Tooltip>

      {picking && (
        /*
         * Above the button, because these sit at the bottom of a card and
         * a tray that opens downwards opens off the end of it.
         */
        <div className="absolute bottom-full left-0 z-30 mb-2 flex animate-pop-in gap-1 rounded-2xl border border-ink-line bg-ink-card p-2 shadow-pop">
          {FACES.map((face, nth) => (
            <button
              key={face}
              style={{ animationDelay: `${nth * 20}ms` }}
              type="button"
              onClick={() => void press(face)}
              aria-label={face.replace('-', ' ')}
              title={face.replace('-', ' ')}
              className={cn(
                'grid h-14 w-14 animate-pop-in place-items-center rounded-xl transition-transform duration-150 hover:scale-110 active:scale-95',
                mine.includes(face) && 'bg-brand/20',
                !mine.includes(face) && full && 'opacity-40',
              )}
            >
              {/* In the tray every face is in colour: this is the place
                  somebody is choosing between them, and ten identical grey
                  faces is a row nobody can choose from. */}
              <Icon name={`reaction-${face}`} tone={FACE_COLOUR[face]} className="h-10 w-10" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
