import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faBolt, faEnvelopeOpenText } from '@fortawesome/free-solid-svg-icons'
import { SignupForm } from '@/components/auth/SignupForm'
import { Button } from '@/components/ui/Button'

/**
 * Making an account without leaving the front page.
 *
 * It is `SignupForm`, the same component `/signup` uses, in a card of its
 * own - not a second form that would drift apart from it the first time a
 * field moved.
 *
 * Once it has been sent the card says so rather than offering itself
 * again: somebody who has just signed up and is looking at an empty
 * sign-up form assumes it did not work.
 */
export function JoinPanel() {
  const [sent, setSent] = useState<string | null>(null)

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-ink-card/85 p-6 shadow-pop backdrop-blur-xl sm:p-7">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-brand/30 blur-3xl"
      />

      <div className="relative">
        {sent ? (
          <div className="py-6 text-center">
            <Glyph icon={faEnvelopeOpenText} className="text-3xl text-space-bright" />
            <h3 className="mt-3 font-display text-xl font-extrabold">Check your email</h3>
            <p className="mt-2 text-sm leading-relaxed text-white/55">
              We sent a link to <span className="font-bold text-white">{sent}</span>. Open it and
              your account is ready.
            </p>
            <Button to="/login" variant="subtle" size="sm" className="mt-5">
              Go to log in
            </Button>
          </div>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-white/70">
              <Glyph icon={faBolt} />
              About a minute
            </span>

            <h3 className="mt-4 font-display text-2xl font-extrabold">Start here</h3>
            <p className="mb-5 mt-1 text-sm text-white/55">
              A name, a birthday and a password. That is the whole of it.
            </p>

            <SignupForm onSent={setSent} />

            <p className="mt-4 text-center text-xs text-white/45">
              Already have an account?{' '}
              <Link to="/login" className="font-bold text-link hover:underline">Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
