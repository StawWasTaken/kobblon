import { NavLink } from 'react-router-dom'
import { Glyph } from '@/components/brand/Glyph'
import {
  faChartSimple, faGaugeHigh, faBoxOpen, faShapes, faUpload, faShirt, faRectangleAd,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { worldIcon } from '@/lib/naming'
import { WorkingAsMenu } from '@/components/create/WorkingAs'
import { cn } from '@/lib/cn'

type Room = {
  to: string
  label: string
  icon: IconDefinition
  end?: boolean
  note: string
}

/** Every room of the Hub, flat, for anything that needs the whole list. */
export const createSections: Room[] = [
  { to: '/create', label: 'Overview', icon: faGaugeHigh, end: true, note: 'Everything at a glance' },
  { to: '/create/worlds', label: 'My Worlds', icon: worldIcon, note: 'The Worlds you build' },
  { to: '/create/uploads', label: 'My Uploads', icon: faUpload, note: 'What you have put in' },
  { to: '/create/avatar', label: 'Things to Wear', icon: faShirt, note: 'For the Catalog' },
  { to: '/create/marketplace', label: 'Marketplace', icon: faShapes, note: 'Anything anybody has made' },
  { to: '/create/inventory', label: 'Inventory', icon: faBoxOpen, note: 'Everything you own' },
  { to: '/create/ads', label: 'Ads', icon: faRectangleAd, note: 'Your work, in front of people' },
  { to: '/create/analytics', label: 'Analytics', icon: faChartSimple, note: 'Views and uses, counted' },
]

/*
 * The same three questions in the same order: what you have made, what you
 * build with, how it is doing. A heading over each, because eight rows in
 * one column is a list you read rather than a place you know your way
 * around.
 */
const GROUPS: { head: string; rooms: Room[] }[] = [
  { head: 'What you have made', rooms: createSections.slice(0, 4) },
  { head: 'What you build with', rooms: createSections.slice(4, 6) },
  { head: 'How it is doing', rooms: createSections.slice(6) },
]

/**
 * The sections of the Hub, kept beside every one of its pages.
 *
 * Staw: "instead of making it into something like in settings, id like to
 * keep a sidebar like in communities" - so it is the Communities rail's
 * shape, flush against the page with a rule down its right rather than a
 * card floating in the margin, and a row is a picture, a name and a second
 * line, exactly as a Community row is.
 */
export function CreateRail({ ownedCount = 0 }: { ownedCount?: number }) {
  return (
    <aside
      className="sticky kob-under-bar kob-under-bar-tall hidden w-72 shrink-0 flex-col overflow-y-auto border-r border-ink-line px-3 pb-6 pt-4 lg:flex kob-scroll"
      aria-label="Creator Hub"
    >
      <p className="mb-2 px-1 font-display text-base font-extrabold">Creator Hub</p>

      <div className="mb-1 px-1">
        <WorkingAsMenu />
      </div>

      {GROUPS.map((group) => (
        <div key={group.head}>
          <p className="px-2 pb-1 pt-3 font-display text-tiny uppercase tracking-wider text-muted">
            {group.head}
          </p>

          {group.rooms.map((room) => (
            <NavLink
              key={room.to}
              to={room.to}
              end={room.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-2 py-2 transition-colors',
                  isActive ? 'bg-brand/20' : 'hover:bg-ink-hover',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
                    isActive ? 'bg-brand text-on-art' : 'bg-ink-raised text-brand-bright',
                  )}>
                    <Glyph icon={room.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn(
                      'block truncate text-sm font-bold',
                      isActive ? 'text-white' : 'text-link',
                    )}>
                      {room.label}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {/* The count where there is one worth carrying: how
                          much you own is the thing you come here asking. */}
                      {room.label === 'Inventory' && ownedCount > 0
                        ? `${ownedCount} · ${room.note}`
                        : room.note}
                    </span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </aside>
  )
}
