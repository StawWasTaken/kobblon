import { NavLink } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { avatarOf } from '@/lib/avatars'
import { mobileNav } from './nav'
import { cn } from '@/lib/cn'

/*
 * The row along the bottom of a phone.
 *
 * Staw sent Polytoria's and said he likes that part of it, so it is worth
 * naming what theirs actually does rather than copying the look of it:
 *
 * - **Five slots, flush, icon over a small word.** No fill behind the one
 *   you are on. Ours had a solid `bg-pick` block behind the active icon,
 *   which on a dark bar reads as a button somebody left pressed.
 * - **The middle slot is your own character, not a sixth drawing.** That is
 *   the whole trick: the bar gets a middle, and the one thing on it that is
 *   about you looks like you. It is also the only slot that changes when
 *   you change something, which is what makes a tab bar feel alive.
 * - **The one you are on is said quietly**, by weight and colour, with a
 *   short bar over the slot rather than under the word.
 *
 * What is ours and not theirs: the mark over the active slot is brand blue,
 * the counts are real, and the five are our five.
 */
export function PhoneBar({ requests, mail }: { requests: number; mail: number }) {
  const { profile } = useAuth()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-line bg-ink-raised/95 backdrop-blur lg:hidden"
      aria-label="Primary"
    >
      <ul className="flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {mobileNav.map((item) => {
          const count = item.badge === 'friends' ? requests
            : item.badge === 'mail' ? mail
            : 0

          return (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-bold transition-colors',
                    isActive ? 'text-white' : 'text-white/45',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Over the slot, not under the word: under it, it sat on
                        the edge of the screen and was half cut off by the
                        home indicator on anything with one. */}
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-x-0 top-[2px] mx-auto h-0.5 w-8 rounded-full transition-colors',
                        isActive ? 'bg-brand-bright' : 'bg-transparent',
                      )}
                    />

                    <span className="relative grid h-8 place-items-center text-base">
                      {item.face && profile ? (
                        <Avatar
                          src={avatarOf(profile)}
                          personId={profile.id}
                          name={profile.display_name}
                          /* `sm` and not a size override: `cn` joins and does
                             not merge, so an `h-7` here beside the
                             component's own `h-6` is decided by whichever
                             rule the stylesheet happens to put last. */
                          size="sm"
                          className={cn(
                            'ring-2 transition-colors',
                            isActive ? 'ring-brand-bright' : 'ring-ink-line',
                          )}
                        />
                      ) : (
                        <Glyph
                          icon={item.icon}
                          name={item.ours}
                          className={isActive ? 'text-brand-bright' : undefined}
                        />
                      )}

                      {count > 0 && (
                        <span className="absolute -right-2 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-space px-1 text-[10px] font-extrabold text-onbrand">
                          {count > 9 ? '9+' : count}
                        </span>
                      )}
                    </span>

                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
