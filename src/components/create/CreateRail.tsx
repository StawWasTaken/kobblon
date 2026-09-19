import { NavLink } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartSimple, faCubes, faGaugeHigh, faBoxOpen, faShapes, faUpload, faRectangleAd,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { WorkingAsMenu } from '@/components/create/WorkingAs'
import { cn } from '@/lib/cn'
import { Tooltip } from '@/components/ui/Tooltip'

export const createSections: {
  to: string
  label: string
  icon: IconDefinition
  end?: boolean
  note: string
}[] = [
  { to: '/create', label: 'Overview', icon: faGaugeHigh, end: true, note: 'Everything at a glance' },
  { to: '/create/spaces', label: 'My Worlds', icon: faCubes, note: 'The Worlds you build' },
  { to: '/create/uploads', label: 'My Uploads', icon: faUpload, note: 'What you have put into Create' },
  { to: '/create/marketplace', label: 'Marketplace', icon: faShapes, note: 'Everything anybody can build with' },
  { to: '/create/inventory', label: 'Inventory', icon: faBoxOpen, note: 'Everything you can build with' },
  { to: '/create/ads', label: 'Ads', icon: faRectangleAd, note: 'Put your work in front of people' },
  { to: '/create/analytics', label: 'Analytics', icon: faChartSimple, note: 'Views and uses, counted' },
]

/** The sections of Create, kept beside every one of its pages. */
export function CreateRail({ ownedCount = 0 }: { ownedCount?: number }) {
  return (
    <aside
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 flex-col overflow-y-auto border-r border-ink-line px-3 pb-6 pt-4 lg:flex kob-scroll"
      aria-label="Kobblon Create"
    >
      <p className="mb-2 px-2 font-display text-base font-extrabold">Create</p>

      <div className="mb-3 px-1">
        <WorkingAsMenu />
      </div>

      {createSections.map((section) => (
        <Tooltip key={section.to} label={section.note} side="right">
        <NavLink
          to={section.to}
          end={section.end}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              isActive ? 'bg-brand text-onbrand' : 'text-white/65 hover:bg-ink-hover hover:text-white',
            )
          }
        >
          <FontAwesomeIcon icon={section.icon} className="w-4 text-xs" />
          <span className="flex-1">{section.label}</span>
          {section.label === 'Inventory' && ownedCount > 0 && (
            <span className="text-[11px] font-bold text-muted">{ownedCount}</span>
          )}
        </NavLink>
        </Tooltip>
      ))}
    </aside>
  )
}
