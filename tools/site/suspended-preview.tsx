/* The suspension card, in both of its states, with nothing around it. */
import { createRoot } from 'react-dom/client'
import { ChatSuspended } from '@/components/chat/ChatSuspended'
import '@/index.css'

const soon = new Date(Date.now() + 4 * 60_000 + 38_000).toISOString()

createRoot(document.getElementById('root')!).render(
  <div className="flex min-h-screen flex-wrap items-start justify-center gap-8 bg-ink p-10">
    <ChatSuspended minutes={5} until={soon} onUnderstand={() => {}} onAppeal={() => {}} />
    <ChatSuspended minutes={6} until={soon} onUnderstand={() => {}} />
    <ChatSuspended minutes={5} until={soon} over onUnderstand={() => {}} />
  </div>,
)
