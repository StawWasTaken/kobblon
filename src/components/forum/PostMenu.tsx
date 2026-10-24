import { faPen, faLink, faFlag, faTrash, faEllipsis } from '@fortawesome/free-solid-svg-icons'
import { Menu, type MenuItem } from '@/components/ui/Menu'
import { Glyph } from '@/components/brand/Glyph'
import { useToast } from '@/components/ui/Toast'

/**
 * The three dots above a post.
 *
 * Staw: "make that we can also edit forum posts when we are the OP, and
 * delete post if we want to too (into a 3 dots button ontop of the post)"
 * and "i want that we can click on the three dots ontop of a post to copy
 * link".
 *
 * What was there before was a row of four buttons under every post -
 * Helpful, Reply, Report, Take it down - which is the heaviest thing a
 * person can do to a thread sitting in the same row as the lightest. So
 * the two that are about the post itself move up here, where a menu is
 * opened on purpose, and the two that are about the conversation stay
 * under it where they are pressed without thinking.
 *
 * Copy link is first and is for everybody, signed in or not. It is the
 * entry a reader uses and the only one most people will ever open this
 * menu for.
 *
 * Nothing here decides a permission. `forum_edit` takes the author and
 * nobody else - not even staff, which is 0276's own rule, because staff
 * take things down rather than rewrite them - and `forum_remove` takes the
 * author or a moderator. These props only decide what is drawn; the
 * database decides what happens.
 */
export function PostMenu({
  link, canEdit, canRemove, canReport, onEdit, onRemove, onReport,
}: {
  /** The address of this post, absolute, for the clipboard. */
  link: string
  canEdit: boolean
  canRemove: boolean
  canReport: boolean
  onEdit: () => void
  onRemove: () => void
  onReport: () => void
}) {
  const toast = useToast()

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link copied.', 'success')
    } catch {
      /*
       * `writeText` throws without a secure context or without permission,
       * and a silent failure here is somebody pasting whatever was in the
       * clipboard before. Saying so is the honest answer; there is no
       * fallback worth building, because the one everybody writes - a
       * hidden textarea and `execCommand` - is removed from the platform.
       */
      toast('Your browser would not let me copy that.', 'error')
    }
  }

  const items: MenuItem[] = [{ label: 'Copy link', icon: faLink, onSelect: copy }]

  if (canEdit) items.push({ label: 'Edit', icon: faPen, onSelect: onEdit })
  if (canReport) items.push({ label: 'Report', icon: faFlag, separated: true, onSelect: onReport })
  if (canRemove) {
    items.push({
      label: 'Delete', icon: faTrash, danger: true, separated: !canReport, onSelect: onRemove,
    })
  }

  return (
    <Menu
      label="What to do with this post"
      items={items}
      trigger={
        <span className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition-colors hover:bg-white/[0.07] hover:text-white">
          <Glyph icon={faEllipsis} />
        </span>
      }
    />
  )
}
