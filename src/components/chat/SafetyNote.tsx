import { Link } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBan, faFlag, faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/cn'
import type { ConversationMember } from '@/types/db'
import { avatarOf } from '@/lib/avatars'
import { profileLink } from '@/lib/links'

/**
 * Opens every conversation and stays at the top of its history, so the
 * reminder is there the tenth time as well as the first.
 */
export function SafetyNote({
  person, onBlock, onReport, onIgnore, ignored, className,
}: {
  person: ConversationMember
  onBlock: () => void
  onReport: () => void
  onIgnore?: () => void
  /** You are ignoring them, so their messages here are covered. */
  ignored?: boolean
  className?: string
}) {
  return (
    <div className={cn('rounded-xl border border-ink-line bg-ink-raised p-3', className)}>
      <Link to={profileLink(person)} className="flex items-center gap-2">
        <Avatar src={avatarOf(person)} personId={person.id} name={person.display_name} size="sm" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-bold">{person.display_name}</span>
          <span className="block truncate text-xs text-muted">@{person.username}</span>
        </span>
      </Link>

      <p className="mt-2.5 text-xs leading-relaxed text-muted">
        {ignored
          ? 'You are ignoring this person. What they write stays covered until you tap it, and none of it reaches you as a notification.'
          : 'Watch who you chat with. Keep personal details private, and block or report anytime.'}
      </p>

      <div className="mt-2.5 flex gap-2">
        {onIgnore && (
          <button
            onClick={onIgnore}
            className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-line bg-ink-card text-xs font-bold text-white/70 transition-colors hover:bg-ink-hover hover:text-white"
          >
            <FontAwesomeIcon icon={ignored ? faEye : faEyeSlash} className="text-[10px]" />
            {ignored ? 'Unignore' : 'Ignore'}
          </button>
        )}
        <button
          onClick={onBlock}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-line bg-ink-card text-xs font-bold text-white/70 transition-colors hover:bg-ink-hover hover:text-white"
        >
          <FontAwesomeIcon icon={faBan} className="text-[10px]" />
          Block
        </button>
        <button
          onClick={onReport}
          className="inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg border border-ink-line bg-ink-card text-xs font-bold text-white/70 transition-colors hover:bg-ink-hover hover:text-white"
        >
          <FontAwesomeIcon icon={faFlag} className="text-[10px]" />
          Report
        </button>
      </div>
    </div>
  )
}
