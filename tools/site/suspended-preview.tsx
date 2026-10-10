/* The suspension card, in both of its states, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { ChatSuspended } from '@/components/chat/ChatSuspended'
import { ChatLockedBar } from '@/components/chat/ChatLockedBar'
import '@/index.css'

const soon = new Date(Date.now() + 4 * 60_000 + 38_000).toISOString()

createRoot(document.getElementById('root')!).render(
  <div className="flex min-h-screen flex-wrap items-start justify-center gap-8 bg-ink p-10">
    <ChatSuspended minutes={5} until={soon} onUnderstand={() => {}} onAppeal={() => {}} />
    <ChatSuspended minutes={6} until={soon} onUnderstand={() => {}} />
    <ChatSuspended minutes={5} until={soon} over onUnderstand={() => {}} />

    <div className="w-[22rem] space-y-3 rounded-xl border border-ink-line bg-ink-raised p-2">
      <p className="px-1 text-xs uppercase tracking-wide text-muted">The box, locked</p>
      <ChatLockedBar until={soon} />
      <ChatLockedBar until={new Date(Date.now() + 2 * 3600_000 + 7 * 60_000).toISOString()} />
      <ChatLockedBar until={soon} kind="voice" />
      <ChatLockedBar until={new Date(Date.now() - 1000).toISOString()} />
    </div>
  </div>,
)
