/* Twemoji, in the shapes that normally break. */
import { createRoot } from 'react-dom/client'
import { Emoji } from '@/components/ui/Emoji'
import '@/index.css'

const lines = [
  'plain  😀 😂 🥺',
  'skin tone  👍🏻 👍🏾 👍🏿',
  'a family, joined  👨‍👩‍👧‍👦',
  'an astronaut  👩‍🚀 and a firefighter 👨‍🚒',
  'flags  🇫🇷 🇬🇧 🇯🇵 🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'the rainbow 🏳️‍🌈 and the trans flag 🏳️‍⚧️',
  'keycaps  1️⃣ 2️⃣ #️⃣',
  'variation or not  ❤️ ❤ ⚠️',
  'two hands, two tones  🧑🏻‍🤝‍🧑🏿',
  'no emoji in this line at all',
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-10 text-white">
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted">In a line of text</p>
      {lines.map((line) => (
        <p key={line} className="text-sm"><Emoji>{line}</Emoji></p>
      ))}
      <p className="pt-4 text-xs uppercase tracking-wide text-muted">In a heading</p>
      <h2 className="font-display text-2xl font-black">
        <Emoji>First Ground 🏗️ — the game built by players 🎮</Emoji>
      </h2>
      <p className="pt-4 text-xs uppercase tracking-wide text-muted">Small</p>
      <p className="text-xs"><Emoji>tiny 😀 beside tiny type</Emoji></p>
    </div>
  </div>,
)
