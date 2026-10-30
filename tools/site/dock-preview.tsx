/* The chat window on its own: the new chrome, rich text and the composer. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { MessageRow } from '@/components/chat/MessageRow'
import { Composer } from '@/components/chat/Composer'
import { Glyph } from '@/components/brand/Glyph'
import { faGear, faXmark, faUserGroup } from '@fortawesome/free-solid-svg-icons'
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

function Window() {
  const [draft, setDraft] = useState('this is **bold**, this is *italic*')
  return (
    <section className="relative flex h-[26rem] w-80 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-t-0 border-ink-line bg-ink-card shadow-pop before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r before:from-brand before:via-brand-bright before:to-space">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line bg-gradient-to-b from-brand-deep/35 to-transparent px-2">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-deep text-[10px] text-white">
          <Glyph icon={faUserGroup} />
        </span>
        <span className="flex-1 truncate font-display text-sm font-extrabold tracking-tight">Movie night</span>
        <Glyph icon={faGear} className="text-white/45" />
        <Glyph icon={faXmark} className="text-white/45" />
      </header>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        <MessageRow message={say(1, 'hi, **look at this**')} sender={them} mine={false} />
        <MessageRow message={say(2, 'that is ~~terrible~~ __great__')} sender={me} mine />
        <MessageRow message={say(3, 'https://static.klipy.com/gif/cat.gif')} sender={them} mine={false} />
      </div>
      <form onSubmit={(e) => e.preventDefault()} className="shrink-0 border-t border-ink-line p-2.5">
        <Composer id="draft" value={draft} onChange={setDraft} onSend={() => {}} />
      </form>
    </section>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <div className="flex min-h-dvh items-end gap-6 bg-ink p-8">
      <Window />
    </div>
  </MemoryRouter>,
)
