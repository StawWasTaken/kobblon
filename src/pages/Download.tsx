import { Link } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { faWindows, faApple, faLinux } from '@fortawesome/free-brands-svg-icons'
import { faCube, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { AboutShell } from '@/components/layout/AboutShell'
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
    <AboutShell
      eyebrow="The player"
      title="Kobblon Launcher"
      lead="Worlds run in the Launcher rather than in a browser tab. You find them here and play them there."
    >
      <div className="max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <p className="flex items-center gap-3 font-display text-lg font-extrabold">
          <Glyph icon={faCube} className="text-brand-bright" />
          Not released yet
        </p>
        <p className="mt-2 text-white/60">
          Nothing to download today. The installers land here the day there are.
        </p>

        <div className="mt-6 flex flex-wrap gap-6 text-sm font-bold text-white/30">
          <span className="flex items-center gap-2">
            <Glyph icon={faWindows} />
            Windows
          </span>
          <span className="flex items-center gap-2">
            <Glyph icon={faApple} />
            macOS
          </span>
          <span className="flex items-center gap-2">
            <Glyph icon={faLinux} />
            Linux
          </span>
        </div>
      </div>

      <Link
        to="/discover"
        className="mt-8 inline-flex items-center gap-2 font-bold text-link hover:underline"
      >
        See what people are making
        <Glyph icon={faArrowRight} className="text-xs" />
      </Link>
    </AboutShell>
  )
}
