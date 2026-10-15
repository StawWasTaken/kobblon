import { useNavigate } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faBolt } from '@fortawesome/free-solid-svg-icons'
import { SignupForm } from '@/components/auth/SignupForm'
import { Kobby } from '@/components/brand/Kobby'

/**
 * Making an account without leaving the front page. It is the same form as
 * the one on the way in, in a panel of its own so the hero has something to
 * press rather than only something to read.
 */
export function JoinPanel() {
  const navigate = useNavigate()

  return (
    <div className="relative">
      <Kobby
        mood="default"
        size="sm"
        bob={false}
        className="pointer-events-none absolute -left-7 -top-12 hidden h-20 -rotate-6 lg:block"
      />

      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-ink-card/95 p-6 shadow-pop backdrop-blur-xl sm:p-7">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand/30 blur-3xl"
        />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white/70">
            <Glyph icon={faBolt} />
            About a minute
          </span>

          <h2 className="mt-3 font-display text-2xl font-extrabold">Start here</h2>
          <p className="mb-5 mt-1 text-sm text-white/55">
            A name, a birthday and a password. That is the whole of it.
          </p>

          <SignupForm onSent={() => navigate('/signup')} />
        </div>
      </div>
    </div>
  )
}
