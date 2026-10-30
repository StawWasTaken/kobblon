import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { faArrowRight, faArrowUp, faSpinner } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { kobbyArt } from '@/components/brand/Kobby'
import { askKobbyAboutTheRules, type KobbyAnswer } from '@/lib/api'
import { cn } from '@/lib/cn'

/**
 * One line on the Policies page: ask, and Kobby answers out of the rules.
 *
 * Staw: "make that in the policy page theres a bar to ask about the
 * policies or certain things about kobblon, and its kobby who answers
 * based on whats written in our policies and the blocked words, etc of
 * the staff console ... make that its not ugly and doesnt take too much
 * space, idk where to put it either tho".
 *
 * So: a bar and not a panel. Closed it is one row - a face, a field, a
 * button - and it only becomes taller once there is something to read.
 * That is the whole design argument. Nine documents are the page; a
 * chat window above them would be a second way to read the rules sitting
 * on top of the first, and the one people trust has to be the documents.
 *
 * It answers signed out, because this page is read before anybody has an
 * account. Everything that decides the answer is on the server: the
 * documents are baked next to the `moderate` function, so nothing here
 * sends a policy and nothing here could send a made-up one.
 *
 * What it deliberately does not do: anything about your account. Kobby
 * reads and explains, and every sentence about a decision ends at
 * `/standing` or `/support`, where a person is. A helper on a page about
 * rules that says "you will be fine" is the platform saying it.
 */
export function AskKobby({
  className,
  tone = 'rules',
  openers,
  size = 'bar',
}: {
  className?: string
  /*
   * Which page it is sitting on, and the only thing it changes is the
   * words. Both tones ask the same function and read the same documents -
   * splitting them into two components would be two bars to fix, and the
   * one thing that actually differs is what the empty field says it is
   * for.
   */
  tone?: 'rules' | 'support'
  /** Questions offered under it, the way somebody would type them. */
  openers?: readonly string[]
  /** `bar` is the row on Policies; `open` is the box Support opens on. */
  size?: 'bar' | 'open'
}) {
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [said, setSaid] = useState<KobbyAnswer | null>(null)
  const [trouble, setTrouble] = useState('')
  const field = useRef<HTMLInputElement>(null)
  const wide = size === 'open'

  const ask = async (text = question) => {
    const wanted = text.trim()
    if (!wanted || asking) return
    setAsking(true)
    setTrouble('')
    try {
      setSaid(await askKobbyAboutTheRules(wanted))
    } catch (why) {
      setSaid(null)
      setTrouble(why instanceof Error ? why.message : 'That did not go through.')
    } finally {
      setAsking(false)
    }
  }

  const askThis = (text: string) => {
    setQuestion(text)
    void ask(text)
  }

  const label = tone === 'support'
    ? 'Ask us anything'
    : 'Ask Kobby about the rules'

  return (
    <div className={cn(!!openers?.length && 'space-y-3', className)}>
    <div
      /*
       * It sits in the hero now, over a photograph, so it has to hold
       * itself up: a blur behind it, one hairline round it, and a shadow
       * under it. That is the whole redesign - nothing added to the row,
       * only enough weight that a single line of UI reads as a surface
       * instead of a rectangle somebody drew on a picture.
       */
      className={cn(
        'group rounded-[1.1rem] border border-white/10 bg-ink/70 shadow-[0_20px_55px_-18px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-colors focus-within:border-brand-bright/60',
        wide && 'rounded-[1.4rem]',
      )}
    >
      <div className={cn('flex items-center gap-3 pl-3.5 pr-2.5 py-2.5', wide && 'gap-4 pl-5 pr-3.5 py-4')}>
        <img
          src={kobbyArt.default}
          alt=""
          aria-hidden="true"
          className={cn(
            'w-auto shrink-0 transition-transform',
            wide ? 'h-11' : 'h-8',
            asking ? 'animate-bounce' : 'group-focus-within:-rotate-6',
          )}
        />
        <input
          ref={field}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void ask() }}
          maxLength={300}
          aria-label={label}
          placeholder={label}
          /*
           * The global `:focus-visible` ring is turned off on this one
           * field, and that is not the accessibility rule being dropped:
           * the ring exists so a keyboard can see where it is, and the
           * bar itself already lights up round the whole row. Two rings,
           * one inside the other, is what Staw was looking at.
           */
          className={cn(
            'min-w-0 flex-1 bg-transparent py-1 text-white placeholder:text-white/35 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0',
            wide ? 'text-base sm:text-lg' : 'text-sm',
          )}
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={!question.trim() || asking}
          aria-label="Ask"
          className={cn(
            'grid shrink-0 place-items-center rounded-full bg-brand text-white transition-all hover:bg-brand-bright hover:scale-105 disabled:scale-100 disabled:bg-white/[0.07] disabled:text-white/25',
            wide ? 'h-11 w-11' : 'h-9 w-9',
          )}
        >
          <Glyph icon={asking ? faSpinner : faArrowUp} className={cn(wide ? 'text-sm' : 'text-xs', asking && 'animate-spin')} />
        </button>
      </div>

      {/* Only ever as tall as there is something to read. */}
      {(!!said || !!trouble) && (
        <div className="animate-pop-in border-t border-white/[0.07] px-4 pb-4 pt-3.5">
          {!!trouble && <p className="text-sm leading-relaxed text-white/60">{trouble}</p>}

          {!!said && (
            <>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/80">
                {said.answer}
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2">
                {said.sources.map((one) => (
                  <Link
                    key={one.slug}
                    to={one.at ?? `/policies/${one.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1 text-[11px] font-extrabold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {one.title}
                    <Glyph icon={faArrowRight} className="text-[10px] text-link" />
                  </Link>
                ))}
                {/* Said on the answer itself rather than in the small print,
                    because the one answer somebody must not act on is the
                    one about their own account. */}
                <span className="text-[11px] text-white/30">
                  Kobby reads the rules; it decides nothing.{' '}
                  <Link to="/support" className="font-bold text-link hover:underline">
                    Write to a person
                  </Link>
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>

    {/*
      * The chips, which are a question and not a heading.
      *
      * They are under the box rather than over it because the box is the
      * thing: a row of suggestions on top reads as the page's navigation
      * and the field underneath as a footnote, which is backwards. Pressing
      * one asks it rather than only filling the field - a suggestion that
      * needs a second click to do anything is a suggestion that gets
      * ignored.
      */}
    {!!openers?.length && (
      <div className="flex flex-wrap gap-2">
        {openers.map((one) => (
          <button
            key={one}
            type="button"
            onClick={() => askThis(one)}
            disabled={asking}
            className="rounded-xl border border-white/10 bg-ink/60 px-3.5 py-2 text-left text-sm font-bold text-white/65 backdrop-blur-xl transition-colors hover:border-brand-bright/50 hover:text-white disabled:opacity-50"
          >
            {one}
          </button>
        ))}
      </div>
    )}
    </div>
  )
}
