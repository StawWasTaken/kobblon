/* The thread, as it reads in a dock: a run from them, a run from you. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { MessageRow } from '@/components/chat/MessageRow'
import { TimeSeparator } from '@/components/chat/TimeSeparator'
import { Composer } from '@/components/chat/Composer'
import { ConversationFace } from '@/components/chat/ConversationFace'
import { Glyph } from '@/components/brand/Glyph'
import { faGear, faXmark } from '@fortawesome/free-solid-svg-icons'
import type { Conversation, Message, ConversationMember } from '@/types/db'
import '@/index.css'

const them: ConversationMember = {
  id: 'b', username: 'rusty', display_name: 'rusty', avatar_url: null,
  is_online: true, in_space_id: 'w1', closed_at: null, is_banned: false,
}

const conversation = {
  id: 'c', title: null, is_group: false, last_message_at: '', last_message: null,
  unread_count: 0, members: [them],
} as Conversation

const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

const say = (over: Partial<Message>): Message => ({
  id: String(Math.random()), conversation_id: 'c', sender_id: 'b',
  body: 'hello', created_at: ago(30), is_removed: false, edited_at: null,
  ...over,
} as Message)

const thread: { m: Message; mine: boolean; grouped: boolean }[] = [
  { m: say({ body: 'you coming?', created_at: ago(44) }), mine: false, grouped: false },
  { m: say({ body: 'rooftop run, four of us', created_at: ago(44) }), mine: false, grouped: true },
  { m: say({ sender_id: 'me', body: 'two minutes', created_at: ago(42) }), mine: true, grouped: false },
  { m: say({ sender_id: 'me', body: 'getting a hat first', created_at: ago(42) }), mine: true, grouped: true },
  { m: say({ body: 'the water tower one is open', created_at: ago(6) }), mine: false, grouped: false },
]

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="min-h-dvh bg-ink p-10">
      <section className="flex h-[26rem] w-80 flex-col overflow-hidden rounded-t-2xl border-2 border-b-0 border-t-0 border-ink-line bg-ink-card shadow-pop">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-ink-line bg-ink px-2">
          <span className="flex min-w-0 flex-1 items-center gap-2 px-1">
            <ConversationFace conversation={conversation} size="sm" />
            <span className="truncate font-display text-note font-extrabold tracking-wide text-white">
              rusty
            </span>
          </span>
          <Glyph icon={faGear} className="text-mini text-white/45" />
          <Glyph icon={faXmark} className="text-mini text-white/45" />
        </header>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-ink px-2.5 py-2.5 kob-scroll">
          <TimeSeparator at={ago(44)} />
          {thread.map(({ m, mine, grouped }) => (
            <MessageRow
              key={m.id}
              message={m}
              sender={mine ? undefined : them}
              mine={mine}
              grouped={grouped}
              onEdit={async () => {}}
              onDelete={async () => {}}
            />
          ))}
        </div>

        <Composer id="x" value="" onChange={() => {}} onSend={() => {}} members={[them]} />
      </section>
    </div>
  </MemoryRouter>,
)
