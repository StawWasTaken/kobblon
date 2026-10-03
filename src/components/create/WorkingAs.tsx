import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faCaretDown, faCheck } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useAsync } from '@/hooks/useAsync'
import { listBuildTargets } from '@/lib/api'
import { avatarOf } from '@/lib/avatars'
import { cn } from '@/lib/cn'
import { Emblem } from '@/components/community/Emblem'
import type { BuildTarget } from '@/types/db'

const KEY = 'kobblon.building-as'

type Context = {
  /** null means you, personally. */
  target: BuildTarget | null
  targets: BuildTarget[]
  setTarget: (next: BuildTarget | null) => void
}

const WorkingAsContext = createContext<Context>({ target: null, targets: [], setTarget: () => {} })

export const useWorkingAs = () => useContext(WorkingAsContext)

/**
 * Who you are making things for. Yourself by default, or a Community you are
 * allowed to build for, in which case what you upload belongs to it and what
 * it sells fills its funds rather than your pocket.
 */
export function WorkingAsProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth()
  const [chosen, setChosen] = useState<string | null>(null)

  const list = useAsync(async () => (profile ? listBuildTargets() : []), [profile?.id])

  useEffect(() => {
    try { setChosen(localStorage.getItem(KEY)) } catch { /* private windows */ }
  }, [])

  const targets = list.data ?? []
  const target = targets.find((t) => t.id === chosen) ?? null

  const value = useMemo<Context>(() => ({
    target,
    targets,
    setTarget: (next) => {
      setChosen(next?.id ?? null)
      try {
        if (next) localStorage.setItem(KEY, next.id)
        else localStorage.removeItem(KEY)
      } catch { /* nothing to do */ }
    },
  }), [target, targets])

  return <WorkingAsContext.Provider value={value}>{children}</WorkingAsContext.Provider>
}

/** The menu itself, which sits at the top of Create. */
export function WorkingAsMenu() {
  const { profile } = useAuth()
  const { target, targets, setTarget } = useWorkingAs()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  if (!profile) return null

  return (
    <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
        Working as
      </span>

      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors',
          open ? 'border-brand-bright bg-ink-hover' : 'border-ink-line bg-ink-card hover:bg-ink-hover',
        )}
      >
        {target ? (
          <Emblem src={target.icon_url} name={target.name} className="h-8 w-8 text-[11px]" />
        ) : (
          <Avatar src={avatarOf(profile)} personId={profile.id} name={profile.display_name} size="sm" className="rounded-lg" />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold">
            {target ? target.name : profile.display_name}
          </span>
          <span className="block text-[11px] text-muted">
            {target ? 'Community' : 'You'}
          </span>
        </span>

        <FontAwesomeIcon
          icon={faCaretDown}
          className={cn('text-xs text-white/45 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-ink-line bg-ink-card py-1 shadow-pop animate-pop-in"
        >
          <button
            role="option"
            aria-selected={!target}
            onClick={() => { setTarget(null); setOpen(false) }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-hover"
          >
            <Avatar src={avatarOf(profile)} personId={profile.id} name={profile.display_name} size="xs" className="rounded-md" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {profile.display_name}
            </span>
            {!target && <FontAwesomeIcon icon={faCheck} className="text-xs text-link" />}
          </button>

          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">
            Communities
          </p>

          {!targets.length && (
            <p className="px-3 pb-2 text-xs leading-relaxed text-muted">
              None yet. A Community you can make things for appears here once somebody gives you
              the Spaces permission there.
            </p>
          )}

          {targets.map((option) => (
            <button
              key={option.id}
              role="option"
              aria-selected={target?.id === option.id}
              onClick={() => { setTarget(option); setOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-ink-hover"
            >
              <Emblem
                src={option.icon_url}
                name={option.name}
                rounded="rounded-md"
                className="h-6 w-6 text-[10px]"
              />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{option.name}</span>
              {target?.id === option.id && (
                <FontAwesomeIcon icon={faCheck} className="text-xs text-link" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** A line saying what the thing you are about to make will belong to. */
export function WorkingAsNote() {
  const { target } = useWorkingAs()
  if (!target) return null
  return (
    <p className="flex items-center gap-2 rounded-lg border border-brand/35 bg-brand/10 px-3 py-2 text-xs text-[#b9c3ff]">
      <FontAwesomeIcon icon={faUser} />
      This will belong to {target.name}, and anything it earns goes into its funds.
    </p>
  )
}
