/* Twemoji by font: everywhere, including the places a component cannot reach. */
import { createRoot } from 'react-dom/client'
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
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-10 text-white">
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted">Body text, nothing wired</p>
      {lines.map((line) => <p key={line} className="text-sm">{line}</p>)}

      <p className="pt-4 text-xs uppercase tracking-wide text-muted">A heading, display face</p>
      <h2 className="font-display text-2xl font-black">First Ground 🏗️ — built by players 🎮</h2>

      <p className="pt-4 text-xs uppercase tracking-wide text-muted">
        Inside an input, and inside its placeholder — a component cannot reach either
      </p>
      <input
        defaultValue="typed into the box 🥺 like this"
        className="h-9 w-full rounded-full border border-ink-line bg-ink-raised px-3.5 text-sm"
      />
      <input
        placeholder="say something nice 😀"
        className="h-9 w-full rounded-full border border-ink-line bg-ink-raised px-3.5 text-sm placeholder:text-white/40"
      />
      <p className="pt-4 text-xs text-muted">and small, beside small type 😀 ❤️ 🎮</p>
    </div>
  </div>,
)
