import type { ReactNode } from 'react'
import { Lane } from './Band'
import { Reveal } from './Reveal'
import { Eyebrow, Title } from './Type'
import { cn } from '@/lib/cn'

/**
 * The opening of an About page.
 *
 * Two shapes, and a page picks the one its subject deserves rather than
 * whichever looks fuller. `split` is for a page with something to show -
 * the words on the left, a render or a character on the right, which is
 * the shape the front of this kind of site has had since Steam's. `plain`
 * is for a page whose subject is words: the rules do not get a picture,
 * because a picture beside a privacy policy is a picture that is there to
 * fill the space.
 *
 * The heading arrives first and the lead after it, by a tenth of a
 * second. It is a small thing and it is the difference between a page
 * that loaded and a page that greeted you.
 */
export function Hero({
  eyebrow, title, lead, actions, art, note, centre = false, className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  lead?: ReactNode
  actions?: ReactNode
  /** The picture on the right. Left out, the hero is the plain shape. */
  art?: ReactNode
  /** A line under the buttons: a date, a count, a caveat. */
  note?: ReactNode
  /**
   * The statement shape: the words centred, the picture under them rather
   * than beside them. For the one page whose opening *is* the sentence.
   */
  centre?: boolean
  className?: string
}) {
  return (
    <Lane className={cn('pb-20 pt-16 sm:pb-28 sm:pt-24', className)}>
      <div className={art && !centre ? 'grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16' : undefined}>
        <div className={centre ? 'mx-auto max-w-4xl text-center' : undefined}>
          {eyebrow && (
            <Reveal><Eyebrow className="mb-5">{eyebrow}</Eyebrow></Reveal>
          )}
          <Reveal delay={60}>
            <Title level={1} className={cn(!art && !centre && 'max-w-4xl')}>{title}</Title>
          </Reveal>
          {lead && (
            <Reveal delay={140}>
              <p className={cn(
                'mt-6 max-w-2xl text-lg leading-relaxed text-white/60 sm:text-xl',
                centre && 'mx-auto',
              )}>
                {lead}
              </p>
            </Reveal>
          )}
          {actions && (
            <Reveal delay={220}>
              <div className={cn(
                'mt-9 flex flex-wrap items-center gap-3',
                centre && 'justify-center',
              )}>
                {actions}
              </div>
            </Reveal>
          )}
          {note && (
            <Reveal delay={280}>
              <p className="mt-5 text-sm font-semibold text-white/35">{note}</p>
            </Reveal>
          )}
        </div>

        {art && (
          <Reveal delay={200} className={centre ? 'mx-auto mt-16 block max-w-4xl' : undefined}>
            {art}
          </Reveal>
        )}
      </div>
    </Lane>
  )
}
