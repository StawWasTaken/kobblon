import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { faArrowRight, faArrowUp } from '@fortawesome/free-solid-svg-icons'
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
export function AskKobby({ className }: { className?: string }) {
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [said, setSaid] = useState<KobbyAnswer | null>(null)
  const [trouble, setTrouble] = useState('')
  const field = useRef<HTMLInputElement>(null)

  const ask = async () => {
    const wanted = question.trim()
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

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/10 bg-ink-card/60 transition-colors focus-within:border-brand-bright/70',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <img
          src={kobbyArt.default}
          alt=""
          aria-hidden="true"
          className={cn('h-7 w-auto shrink-0', asking && 'animate-bounce')}
        />
        <input
          ref={field}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void ask() }}
          maxLength={300}
          aria-label="Ask Kobby about the rules"
          placeholder="Ask Kobby about the rules - how old do I have to be?"
          /*
           * The global `:focus-visible` ring is turned off on this one
           * field, and that is not the accessibility rule being dropped:
           * the ring exists so a keyboard can see where it is, and the
           * bar itself already lights up round the whole row. Two rings,
           * one inside the other, is what Staw was looking at.
           */
          className="min-w-0 flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={!question.trim() || asking}
          aria-label="Ask"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-white transition-colors hover:bg-brand-bright disabled:bg-white/10 disabled:text-white/30"
        >
          <Glyph icon={faArrowUp} className="text-xs" />
        </button>
      </div>

      {/* Only ever as tall as there is something to read. */}
      {(!!said || !!trouble) && (
        <div className="animate-pop-in border-t border-white/10 px-4 py-4">
          {!!trouble && <p className="text-sm leading-relaxed text-white/60">{trouble}</p>}

          {!!said && (
            <>
              <p className="whitespace-pre-line text-sm leading-relaxed text-white/75">
                {said.answer}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {said.sources.map((one) => (
                  <Link
                    key={one.slug}
                    to={`/policies/${one.slug}`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-extrabold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
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
  )
}
