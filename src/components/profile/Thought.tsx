import { useEffect, useRef, useState } from 'react'
import { faPen, faPlus } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { FACE_COLOUR } from '@/components/social/Reactions'
import { FACES, type Face } from '@/lib/api'
import { cn } from '@/lib/cn'

/** As long as a thought may be, matching `profiles_thought_check`. */
export const THOUGHT_LIMIT = 120

/** The face beside it is one of the eleven, or none. */
export function faceOf(name?: string | null): Face | null {
  return FACES.includes(name as Face) ? (name as Face) : null
}

/** The face at the left of a thought, drawn the size the place wants. */
function ThoughtFace({ face, className }: { face: Face; className?: string }) {
  return (
    <Icon
      name={`reaction-${face}`}
      tone={FACE_COLOUR[face]}
      className={cn('shrink-0', className)}
    />
  )
}

/*
 * A thought: the one line somebody has over their head.
 *
 * It is a thinking bubble rather than a speaking one - the big shape with
 * the words, a smaller circle that still belongs to it, and one more on its
 * own at the bottom - because it is what they are thinking rather than
 * something they said to you. The Launcher draws the same thing over a
 * player in a World; this is that in two dimensions.
 *
 * **It sits over the picture and does not move it.** The first draft put
 * the bubble above the avatar in the same column, so writing a thought
 * pushed somebody's face down the page; Staw: "it moves the pfp while i
 * want it to stay where it is, just the thought gets OVER it". So this is
 * `ThoughtOver`, which wraps the picture and lays the bubble on top of it -
 * half over the top of the picture, half over whatever is behind it.
 *
 * Everywhere somebody is listed it is a line with no bubble at all, beside
 * the dot that says whether they are here, the way a status is.
 */
export function ThoughtOver({ thought, face, mine, small, onEdit, children, className }: {
  thought?: string | null
  face?: string | null
  /** Your own page: an empty bubble invites you to write one. */
  mine?: boolean
  /**
   * A middle-sized picture - a row in a friends list rather than the one
   * at the top of a profile. Same shape, fewer words across it, and it
   * never invites: an empty bubble on every row of a list is a list of
   * empty bubbles.
   */
  small?: boolean
  onEdit?: () => void
  children: React.ReactNode
  className?: string
}) {
  const said = thought?.trim()
  const wearing = faceOf(face)
  const show = !!said || (!!mine && !small)

  const bubble = (
    /*
     * Staw's own drawing of it, as an SVG: a rounded rectangle, a circle
     * whose centre sits on its bottom edge about four fifths of the way
     * across, and a small one below and a little to its left. Three
     * shapes, one colour, no outline on any of them - so the circle on the
     * edge reads as the bubble swelling rather than as a second thing
     * stuck to it.
     */
    <span
      className={cn(
        'relative block',
        mine && 'transition-transform group-active:translate-y-[2px]',
      )}
    >
      <span
        className={cn(
          'relative block w-max rounded-2xl bg-thought text-center font-bold text-thought-ink',
          small
            ? 'max-w-[8.5rem] px-2.5 py-1.5 text-[0.65rem] leading-[0.85rem]'
            : 'max-w-[11rem] px-3.5 py-2 text-xs leading-[1.1rem]',
        )}
      >
        <span className="flex items-center gap-1.5">
          {wearing && <ThoughtFace face={wearing} className="h-4 w-4" />}
          <span className="line-clamp-2 flex-1">{said || 'What are you thinking?'}</span>
          {mine && <Glyph icon={faPen} className="shrink-0 text-[0.6rem] opacity-50" />}
        </span>

        {/* Centred on the bottom edge, so half of it shows. */}
        <span
          className={cn(
            'absolute left-[79%] top-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-thought',
            small ? 'h-3 w-3' : 'h-[1.05rem] w-[1.05rem]',
          )}
        />
      </span>

      {/* And the little one, carrying on down and to the left. */}
      <span
        className={cn(
          'absolute left-[67%] top-full -translate-x-1/2 rounded-full bg-thought',
          small ? 'mt-1 h-1.5 w-1.5' : 'mt-[0.45rem] h-2 w-2',
        )}
      />
    </span>
  )

  return (
    <div className={cn('relative', className)}>
      {children}

      {show && (
        <div className="pointer-events-none absolute inset-x-0 bottom-[60%] z-20 flex flex-col items-center">
          {mine ? (
            <button
              type="button"
              onClick={onEdit}
              aria-label={said ? 'Change your thought' : 'Write a thought'}
              className="group pointer-events-auto flex flex-col items-center"
            >
              {bubble}
            </button>
          ) : (
            bubble
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The same thing with no bubble, for a row in a list: the face, then one
 * line, cut off where it runs out of room. It goes where the word Online
 * would be, because that is what it is - a status.
 */
export function ThoughtLine({ thought, face, className }: {
  thought?: string | null
  face?: string | null
  className?: string
}) {
  const said = thought?.trim()
  if (!said) return null
  const wearing = faceOf(face)

  return (
    <span className={cn('flex min-w-0 items-center gap-1', className)}>
      {wearing && <ThoughtFace face={wearing} className="h-3.5 w-3.5" />}
      <span className="truncate">{said}</span>
    </span>
  )
}

/**
 * Writing one: the line, and a face from the set that is already on every
 * post and every World. Not an emoji - an emoji is whatever font is on the
 * machine, and these are ours.
 *
 * The limit is the database's, said out loud rather than enforced quietly:
 * a box that silently stops taking letters reads as broken.
 */
export function ThoughtDialog({ open, onClose, thought, face, onSave }: {
  open: boolean
  onClose: () => void
  thought?: string | null
  face?: string | null
  onSave: (next: { thought: string | null; face: Face | null }) => Promise<void>
}) {
  const [text, setText] = useState(thought ?? '')
  const [wearing, setWearing] = useState<Face | null>(faceOf(face))
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const picker = useRef<HTMLDivElement>(null)

  /* A list that only closes by choosing is a list you cannot put away. */
  useEffect(() => {
    if (!picking) return
    const away = (e: PointerEvent) => {
      if (!picker.current?.contains(e.target as Node)) setPicking(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [picking])

  const said = text.trim()
  const unchanged = said === (thought ?? '').trim() && wearing === faceOf(face)

  const save = async (next: { thought: string | null; face: Face | null }) => {
    setSaving(true)
    try {
      await onSave(next)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your thought"
      description="One line over your head."
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => save({ thought: said || null, face: said ? wearing : null })}
            disabled={saving || unchanged}
          >
            Save
          </Button>
          {!!thought?.trim() && (
            <Button variant="ghost" onClick={() => save({ thought: null, face: null })} disabled={saving}>
              Take it down
            </Button>
          )}
        </div>
      }
    >
      {/*
        * The face sits at the left of the line, the way it sits in the
        * bubble, and it is a plus until there is one. The eleven open from
        * it rather than lying on the card: a grid of faces under the box
        * made the smaller of the two things look like the point of it.
        */}
      <div ref={picker}>
        <div className="flex items-end gap-2">
          <button
            type="button"
            aria-haspopup="true"
            aria-expanded={picking}
            aria-label={wearing ? `Face: ${wearing.replace('-', ' ')}` : 'Add a face'}
            onClick={() => setPicking((was) => !was)}
            className={cn(
              'grid h-[2.85rem] w-[2.85rem] shrink-0 place-items-center rounded-xl border-2 transition-colors',
              picking ? 'border-brand bg-ink-hover' : 'border-ink-line bg-ink hover:border-brand/50',
            )}
          >
            {wearing
              ? <Icon name={`reaction-${wearing}`} tone={FACE_COLOUR[wearing]} className="h-6 w-6" />
              : <Glyph icon={faPlus} className="text-sm text-muted" />}
          </button>

          <Input
            label="Thought"
            labelNote={`${said.length}/${THOUGHT_LIMIT}`}
            value={text}
            maxLength={THOUGHT_LIMIT}
            autoFocus
            placeholder="What are you thinking?"
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {picking && (
          <div className="mt-2 rounded-2xl border-2 border-ink-line bg-ink p-2">
            <div className="flex flex-wrap gap-1">
              {FACES.map((one) => (
                <button
                  key={one}
                  type="button"
                  aria-label={one.replace('-', ' ')}
                  onClick={() => { setWearing(wearing === one ? null : one); setPicking(false) }}
                  className={cn(
                    'grid h-10 w-10 place-items-center rounded-xl transition-colors',
                    wearing === one ? 'bg-ink-hover' : 'hover:bg-ink-hover',
                  )}
                >
                  <Icon name={`reaction-${one}`} tone={FACE_COLOUR[one]} className="h-6 w-6" />
                </button>
              ))}
            </div>

            {wearing && (
              <button
                type="button"
                onClick={() => { setWearing(null); setPicking(false) }}
                className="mt-1 w-full rounded-xl px-2 py-1.5 text-left text-xs font-bold text-muted hover:bg-ink-hover"
              >
                No face
              </button>
            )}
          </div>
        )}
      </div>

    </Dialog>
  )
}
