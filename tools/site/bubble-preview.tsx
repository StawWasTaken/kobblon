/* Chat bubbles on their own, to look at the corner nearest the avatar. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { MessageRow } from '@/components/chat/MessageRow'
import type { ConversationMember, Message } from '@/types/db'
import '@/index.css'

const them: ConversationMember = {
  id: 'a', username: 'staw', display_name: 'staw', avatar_url: null,
  is_guest: false, is_online: true, in_space_id: null,
} as ConversationMember
const me: ConversationMember = { ...them, id: 'b', username: 'you', display_name: 'you' }

const say = (id: number, body: string): Message =>
  ({ id, conversation_id: 'c', sender_id: id % 2 ? 'a' : 'b', body,
     is_removed: false, created_at: new Date().toISOString(), edited_at: null } as Message)

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-8">
      <div className="mx-auto flex w-72 flex-col gap-1.5 rounded-xl border border-ink-line bg-ink-card p-3">
        <MessageRow message={say(1, 'hi')} sender={them} mine={false} />
        <MessageRow message={say(2, 'hey, how is the world going?')} sender={me} mine />
        <MessageRow message={say(3, 'good — ••••••  got masked though')} sender={them} mine={false} />
        <MessageRow message={say(4, 'ok')} sender={me} mine />
      </div>
    </div>
  </MemoryRouter>,
)
