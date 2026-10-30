/* The chat window on its own: the card's chrome, rich text and the composer. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { MessageRow } from '@/components/chat/MessageRow'
import { Composer } from '@/components/chat/Composer'
import { Glyph } from '@/components/brand/Glyph'
import { TitleTips } from '@/components/ui/TitleTips'
import { faGear, faXmark, faUserGroup } from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'
import type { ConversationMember, Message } from '@/types/db'
import '@/index.css'

const them: ConversationMember = {
  id: 'a', username: 'staw', display_name: 'staw', avatar_url: null,
  is_guest: false, is_online: true, in_space_id: null,
} as ConversationMember
const mine: ConversationMember = { ...them, id: 'b', username: 'you', display_name: 'you' }

const say = (id: number, body: string, back = 0): Message =>
  ({ id, conversation_id: 'c', sender_id: id % 2 ? 'a' : 'b', body,
     is_removed: false, created_at: new Date(Date.now() - back).toISOString(),
     edited_at: null } as Message)

function Window() {
  const [draft, setDraft] = useState('this is **bold**, this is *italic* and hello @staw')
  const [card, setCard] = useState(false)
  const people = useMemo(() => new Set(['staw', 'you']), [])

  return (
    <section
      className={cn(
        'relative flex w-[29rem] flex-col overflow-hidden rounded-t-2xl border border-b-0 border-t-0',
        'border-ink-line bg-ink-card/80 shadow-card backdrop-blur-md',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r',
        'before:from-brand before:via-brand-bright before:to-space',
        'transition-[height] duration-150',
        card ? 'h-[33rem]' : 'h-[19rem]',
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-line px-3.5">
        <span className="grid h-6 w-6 place-items-center rounded-md text-[12px] text-muted">
          <Glyph icon={faUserGroup} />
        </span>
        <span className="flex-1 truncate text-[13px] font-extrabold tracking-wide text-white">Movie night</span>
        <Glyph icon={faGear} className="text-muted" />
        <Glyph icon={faXmark} className="text-muted" />
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5 kob-scroll">
        <MessageRow message={say(1, 'hi, **look at this**', 12_000)} sender={them} mine={false} people={people} me="you" />
        <MessageRow message={say(2, 'that is ~~terrible~~ __great__', 300_000)} sender={mine} mine people={people} me="you" />
        <MessageRow message={say(3, '@you have you seen KOBBLONISTHEBESTGAMEEVERMADEEEE', 3_600_000)} sender={them} mine={false} people={people} me="you" />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="flex shrink-0 flex-col">
        <Composer
          id="draft"
          value={draft}
          onChange={setDraft}
          onSend={() => {}}
          members={[them, mine]}
          me="you"
          onCard={setCard}
        />
      </form>
    </section>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter>
    <TitleTips />
    <div className="flex min-h-dvh items-end gap-6 bg-ink p-8">
      <Window />
    </div>
  </MemoryRouter>,
)
