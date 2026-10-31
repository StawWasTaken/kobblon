/* The chat window on its own: the card's chrome, rich text and the composer. */
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { MessageRow, DeletedRun } from '@/components/chat/MessageRow'
import { Composer } from '@/components/chat/Composer'
import { Glyph } from '@/components/brand/Glyph'
import { Icon } from '@/components/brand/Icon'
import { TitleTips } from '@/components/ui/TitleTips'
import { ToastProvider } from '@/components/ui/Toast'
import {
  faGear, faXmark, faUserGroup, faChevronDown, faMagnifyingGlass, faPenToSquare,
} from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'
import type { ConversationMember, Message } from '@/types/db'
import '@/index.css'

/*
 * Klipy, answered here.
 *
 * The GIF button is drawn only when the `gifs` function says GIFs work,
 * and that function wants a key and a session - neither of which a bare
 * page under `tools/site` has. Without this the one control Staw asked
 * about is the one control the preview cannot show, which makes the
 * screenshot useless for the thing it is being taken for.
 *
 * It answers the function's own shape and nothing else, so what is being
 * looked at is the real card drawing a real answer. The pictures are
 * drawn here rather than fetched: this page has no network either.
 */
const swatch = (hue: number) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180">
       <rect width="240" height="180" fill="hsl(${hue} 60% 45%)"/>
       <circle cx="120" cy="90" r="46" fill="hsl(${(hue + 40) % 360} 75% 70%)"/>
     </svg>`,
  )}`

const realFetch = window.fetch.bind(window)
window.fetch = (input, init) => {
  const where = typeof input === 'string' ? input : (input as Request).url ?? String(input)
  if (where.includes('/functions/v1/gifs')) {
    const items = [160, 10, 280, 95, 210, 45, 330, 130].map((hue, at) => ({
      id: `g${at}`, url: swatch(hue), width: 240, height: at % 3 ? 180 : 240,
    }))
    return Promise.resolve(new Response(JSON.stringify({ items }), {
      headers: { 'content-type': 'application/json' },
    }))
  }
  return realFetch(input as RequestInfo, init)
}

const them: ConversationMember = {
  id: 'a', username: 'staw', display_name: 'staw', avatar_url: null,
  is_guest: false, is_online: true, in_space_id: null,
} as ConversationMember
const mine: ConversationMember = { ...them, id: 'b', username: 'you', display_name: 'you' }

const say = (
  id: number, body: string, back = 0, extra: Partial<Message> = {},
): Message =>
  ({ id, conversation_id: 'c', sender_id: id % 2 ? 'a' : 'b', body,
     is_removed: false, created_at: new Date(Date.now() - back).toISOString(),
     edited_at: null, ...extra } as Message)

const nothing = async () => {}

/** The friends list, which is the shape every window down there takes. */
function TheList() {
  return (
    <section
      className={cn(
        'relative flex w-80 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-t-0',
        'border-ink-line bg-ink-card shadow-pop h-[26rem]',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r',
        'before:from-brand before:via-brand-bright before:to-space',
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line bg-black/30 px-3">
        <span className="flex flex-1 items-center gap-2 text-sm font-extrabold">
          <Icon name="chatbubble" className="h-4 w-4" />
          Friends Chat
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-md text-white/45">
          <Glyph icon={faPenToSquare} />
        </span>
        <span className="grid h-7 w-7 place-items-center rounded-md text-white/45">
          <Glyph icon={faChevronDown} />
        </span>
      </header>

      <div className="relative shrink-0 p-2">
        <Glyph
          icon={faMagnifyingGlass}
          className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-xs text-white/35"
        />
        <input
          readOnly
          placeholder="Search for friends"
          className="h-9 w-full rounded-full border border-ink-line bg-ink-raised pl-8 pr-3 text-sm placeholder:text-white/30"
        />
      </div>

      <div className="flex-1 overflow-y-auto kob-scroll">
        {['staw', 'kobby', 'Movie night'].map((who) => (
          <span key={who} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-deep text-xs text-white">
              <Glyph icon={faUserGroup} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{who}</span>
              <span className="block truncate text-xs text-muted">EEEEE</span>
            </span>
            <span className="shrink-0 text-[11px] text-muted">6d ago</span>
          </span>
        ))}
      </div>
    </section>
  )
}

function Window() {
  const [draft, setDraft] = useState('hello @staw')
  const [card, setCard] = useState(false)
  const people = useMemo(() => new Set(['staw', 'you']), [])

  return (
    <section
      className={cn(
        'relative flex w-80 flex-col overflow-hidden rounded-t-2xl border border-b-0 border-t-0',
        'border-ink-line bg-ink-card shadow-pop',
        'before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-gradient-to-r',
        'before:from-brand before:via-brand-bright before:to-space',
        'transition-[height] duration-150',
        card ? 'h-[45rem] max-h-[85vh]' : 'h-[26rem]',
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-ink-line bg-black/30 px-2">
        <span className="grid h-6 w-6 place-items-center rounded-md text-[12px] text-muted">
          <Glyph icon={faUserGroup} />
        </span>
        <span className="flex-1 truncate text-[13px] font-extrabold tracking-wide text-white">Movie night</span>
        <span className="grid h-6 w-6 place-items-center rounded-lg text-[11px] text-white/45">
          <Glyph icon={faGear} />
        </span>
        <span className="grid h-6 w-6 place-items-center rounded-lg text-[11px] text-white/45">
          <Glyph icon={faXmark} />
        </span>
      </header>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-2.5 kob-scroll">
        <MessageRow
          message={say(1, 'hi, **look at this**', 12_000)}
          sender={them} mine={false} people={people} me="you"
          onEdit={nothing} onDelete={nothing}
        />
        <DeletedRun count={6} />
        <MessageRow
          message={say(2, 'that is ~~terrible~~ __great__', 300_000,
            { edited_at: new Date().toISOString() })}
          sender={mine} mine people={people} me="you"
          onEdit={nothing} onDelete={nothing}
        />
        <MessageRow
          message={say(3, '@you have you seen KOBBLONISTHEBESTGAMEEVERMADEEEE', 3_600_000)}
          sender={them} mine={false} people={people} me="you"
          onEdit={nothing} onDelete={nothing}
        />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="flex shrink-0 flex-col">
        <Composer
          id="draft"
          value={draft}
          onChange={setDraft}
          onSend={() => {}}
          onSendText={() => {}}
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
    <ToastProvider>
      <div className="flex min-h-dvh items-end gap-6 bg-ink p-8">
        <Window />
        <TheList />
      </div>
    </ToastProvider>
  </MemoryRouter>,
)
