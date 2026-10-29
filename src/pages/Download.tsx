import { faWindows, faApple, faLinux } from '@fortawesome/free-brands-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { Glyph } from '@/components/brand/Glyph'
import { AboutShell } from '@/components/layout/AboutShell'
import { Band, Lane } from '@/components/about/Band'
import { useAtTitle, useSocialCard } from '@/hooks/useTitle'

/*
 * Where the Launcher comes from.
 *
 * Staw, on the version that opened on a World with a held title over it:
 * "why are you making the download page like it needs headers and
 * presentation, its just a download page." He is right. A download page is
 * the name of the thing, the platforms it runs on, and the button - and
 * when there is no button yet, it says that and stops. What Kobblon is has
 * a page of its own and does not need saying again here.
 *
 * When there are installers the three rows become buttons and the line
 * under the title changes. Nothing else on the page has to move.
 */

const platforms: { name: string; icon: IconDefinition; note: string }[] = [
  { name: 'Windows', icon: faWindows, note: '10 and 11' },
  { name: 'macOS', icon: faApple, note: 'Apple silicon' },
  { name: 'Linux', icon: faLinux, note: 'Debian and Arch' },
]

export default function Download() {
  useAtTitle('Get the Launcher')
  useSocialCard({
    title: 'Get the Kobblon Launcher',
    description: 'Worlds run in the Kobblon Launcher. It is being built.',
    image: null,
  })

  return (
    <AboutShell>
      <Band tone="raised" tight>
        <Lane>
          <div className="max-w-3xl">
          <h1 className="font-display text-3xl font-extrabold leading-none">
            Kobblon Launcher
          </h1>
          <p className="mt-3 text-white/55">
            Worlds run in the Launcher rather than in a browser tab. It is being
            built, so there is nothing to download yet.
          </p>

          <div className="mt-8 space-y-2.5">
            {platforms.map((one) => (
              <div
                key={one.name}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-ink-card/50 px-5 py-4"
              >
                <Glyph icon={one.icon} className="text-xl text-white/35" />
                <div className="min-w-0">
                  <p className="font-display font-extrabold leading-none text-white/75">
                    {one.name}
                  </p>
                  <p className="mt-1.5 truncate text-xs font-semibold text-white/35">
                    {one.note}
                  </p>
                </div>
                <span className="ml-auto rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/35">
                  Not yet
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-sm font-semibold text-white/30">
            No release date, and none is being guessed at here.
          </p>
          </div>
        </Lane>
      </Band>
    </AboutShell>
  )
}
