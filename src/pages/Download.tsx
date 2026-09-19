import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWindows, faApple, faLinux } from '@fortawesome/free-brands-svg-icons'
import { faCube, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { Wordmark } from '@/components/brand/Wordmark'
import { PixelField } from '@/components/brand/PixelField'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { useForceDark } from '@/hooks/useTheme'
import { useTitle, useSocialCard } from '@/hooks/useTitle'

/*
 * Where the Launcher comes from.
 *
 * It is not released, so this page says that plainly rather than showing
 * three buttons that download nothing. When there are installers, they go
 * here and the notice comes off.
 */
export default function Download() {
  useForceDark()
  useTitle('Get the Launcher')
  useSocialCard({
    title: 'Get the Kobblon Launcher',
    description: 'The Kobblon Launcher plays experiences. It is being built.',
    image: null,
  })

  return (
    <div className="relative min-h-dvh overflow-hidden bg-ink text-white">
      <PixelField className="opacity-30" />
      <div className="absolute inset-0 bg-[radial-gradient(80rem_44rem_at_50%_-15%,rgba(27,52,232,0.4),transparent_62%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/30 via-ink/85 to-ink" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Wordmark to="/" className="h-6" />
          <Link to="/discover" className="text-sm font-semibold text-white/50 hover:text-white">
            Discover
          </Link>
        </header>

        <section className="py-12 sm:py-20">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/40">
            The player
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-5xl font-extrabold leading-[0.9] sm:text-7xl">
            Kobblon Launcher
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/60">
            Experiences run in the Launcher rather than in a browser tab. You find them here and
            play them there.
          </p>

          <div className="mt-10 max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <p className="flex items-center gap-3 font-display text-lg font-extrabold">
              <FontAwesomeIcon icon={faCube} className="text-brand-bright" />
              Not released yet
            </p>
            <p className="mt-2 leading-relaxed text-white/60">
              It is being built. There is nothing to download today, and this page will carry the
              installers the day there are. Nothing here will pretend otherwise in the meantime.
            </p>

            <div className="mt-6 flex flex-wrap gap-6 text-sm font-bold text-white/30">
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faWindows} />
                Windows
              </span>
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faApple} />
                macOS
              </span>
              <span className="flex items-center gap-2">
                <FontAwesomeIcon icon={faLinux} />
                Linux
              </span>
            </div>
          </div>

          <Link
            to="/discover"
            className="mt-8 inline-flex items-center gap-2 font-bold text-link hover:underline"
          >
            See what people are making
            <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
          </Link>
        </section>
      </div>

      <SiteFooter className="relative border-white/10 bg-transparent" />
    </div>
  )
}
