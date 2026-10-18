/* The reaction row and its tray, with nothing around them. */
import { createRoot } from 'react-dom/client'
import { Reactions } from '@/components/social/Reactions'
import { ToastProvider } from '@/components/ui/Toast'
import type { ReactionCount } from '@/lib/api'
import '@/index.css'

const some: ReactionCount[] = [
  { face: 'sunglasses', how_many: 8, mine: true },
  { face: 'heart-eyes', how_many: 7, mine: true },
  { face: 'laugh', how_many: 5, mine: false },
  { face: 'smile', how_many: 2, mine: false },
  { face: 'fire', how_many: 1, mine: true },
]

createRoot(document.getElementById('root')!).render(
  <ToastProvider>
    <div className="min-h-screen space-y-10 bg-ink p-10">
      <div className="rounded-2xl border border-ink-line bg-ink-card p-4">
        <p className="mb-3 text-sm text-muted">A post, with reactions on it.</p>
        <Reactions what="post" which="preview" counts={some} />
      </div>

      <div className="rounded-2xl border border-ink-line bg-ink-card p-4">
        <p className="mb-3 text-sm text-muted">Nothing pressed yet.</p>
        <Reactions what="post" which="preview-2" counts={[]} />
      </div>
    </div>
  </ToastProvider>,
)
