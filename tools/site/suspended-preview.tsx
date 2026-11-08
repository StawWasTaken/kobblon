/* The suspension card, in both of its states, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { ChatSuspended } from '@/components/chat/ChatSuspended'
import { ChatLockedBar } from '@/components/chat/ChatLockedBar'
import '@/index.css'

const soon = new Date(Date.now() + 4 * 60_000 + 38_000).toISOString()

createRoot(document.getElementById('root')!).render(
  <div className="flex min-h-screen flex-wrap items-start justify-center gap-8 bg-ink p-10">
    <ChatSuspended
      minutes={5}
      until={soon}
      onUnderstand={() => {}}
      onAppeal={() => {}}
      ruleOrd={5}
      ruleTitle="Kobblon chat is not for sex"
      evidence="i wanna take you by your ••••"
      reason="A sexual proposition aimed at the person it was sent to."
    />
    <ChatSuspended
      minutes={45}
      until={soon}
      onUnderstand={() => {}}
      ruleOrd={1}
      ruleTitle="Leave people alone when they ask"
      channels={['chat', 'voice']}
      evidence="follow you everywhere until you cry"
      reason="Following somebody around after being told to stop."
    />
    {/* Out of voice chat: the same card, one different tap. */}
    <ChatSuspended
      minutes={20}
      until={soon}
      spoken
      onUnderstand={() => {}}
      onAppeal={() => {}}
      ruleOrd={2}
      ruleTitle="Do not go after people"
      channels={['chat', 'voice']}
      evidence="youre a •••• and everyone here knows it"
      reason="A slur aimed at somebody in the room."
    />
    <ChatSuspended
      minutes={20}
      until={soon}
      spoken
      appealed
      onUnderstand={() => {}}
      onAppeal={() => {}}
      ruleOrd={2}
      ruleTitle="Do not go after people"
      channels={['chat', 'voice']}
      evidence="youre a •••• and everyone here knows it"
      reason="A slur aimed at somebody in the room."
    />
    <ChatSuspended minutes={6} until={soon} onUnderstand={() => {}} />
    <ChatSuspended minutes={5} until={soon} over onUnderstand={() => {}} />

    <div className="w-[24rem] space-y-3 rounded-xl border border-ink-line bg-ink-raised p-2">
      <p className="px-1 text-xs uppercase tracking-wide text-muted">The box, locked</p>
      {/* Everything a decision carries, which is what the dock hands it. */}
      <ChatLockedBar
        until={soon}
        ruleOrd={5}
        ruleTitle="Kobblon chat is not for sex"
        reason="A sexual proposition aimed at the person it was sent to."
        source="kobby"
        onDetails={() => {}}
      />
      {/* Both ways of talking, hours left, and a moderator behind it. */}
      <ChatLockedBar
        until={new Date(Date.now() + 2 * 3600_000 + 7 * 60_000).toISOString()}
        channels={['chat', 'voice']}
        ruleOrd={1}
        ruleTitle="Leave people alone when they ask"
        reason="Following somebody around after being told to stop."
        source="staff"
        onDetails={() => {}}
      />
      {/* Voice only, and the glyph says so. */}
      <ChatLockedBar until={soon} channels={['voice']} source="filter" onDetails={() => {}} />
      {/* Nothing but a time, which is the old mount and still has to read. */}
      <ChatLockedBar until={soon} />
      <ChatLockedBar until={new Date(Date.now() - 1000).toISOString()} />
    </div>
  </div>,
)
