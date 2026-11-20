import { Icon } from '@/components/brand/Icon'
import { PersonAvatar } from '@/components/ui/PersonAvatar'
import { cn } from '@/lib/cn'
import type { Conversation } from '@/types/db'

/**
 * Whether a conversation is one other person or a room full of them.
 *
 * It used to be `members.length === 1`, and `members` is everybody *but*
 * you - so a party of two and a group of two both looked like a chat with
 * one person. They got that person's face, that person's name, and the
 * card that offers to block them, inside a window that was not about them
 * at all. Staw, with a picture of exactly that: "in the group members (&
 * pfp) its not only the other person, its EVERYONE including you".
 *
 * So what it is comes from what it is, not from how many are in it.
 */
export function soloOf(conversation: Conversation) {
  if (conversation.party_id || conversation.is_group) return null
  return conversation.members.length === 1 ? conversation.members[0] : null
}

/**
 * The face on a conversation.
 *
 * One person wears their own. A party and a group wear a mark on a white
 * tile, because the thing on the other side of them is everybody - Staw:
 * "the pfp should be an icon instead like the party icon in green on a
 * white background and for group chats its the friends icon in brand blue
 * onto a white background".
 */
export function ConversationFace({ conversation, size = 'sm', className }: {
  conversation: Conversation
  size?: 'xs' | 'sm' | 'md'
  className?: string
}) {
  const solo = soloOf(conversation)
  if (solo) return <PersonAvatar person={solo} size={size} className={className} />

  const box = size === 'xs' ? 'h-6 w-6' : size === 'md' ? 'h-10 w-10' : 'h-8 w-8'
  const mark = size === 'xs' ? 'h-3.5 w-3.5' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-white ring-2',
        conversation.party_id ? 'ring-space/40' : 'ring-brand/40',
        box,
        className,
      )}
    >
      <Icon
        name={conversation.party_id ? 'party' : 'users'}
        tone={conversation.party_id ? '#1CAE71' : undefined}
        className={cn(mark, !conversation.party_id && 'text-brand')}
      />
    </span>
  )
}
