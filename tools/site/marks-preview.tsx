/* The two marks that go with a name, at the sizes they are actually used. */
import { createRoot } from 'react-dom/client'
import { NameMarks } from '@/components/brand/Verified'
import '@/index.css'

const people = [
  { who: 'Staw', is_admin: true, is_verified: true },
  { who: 'A moderator', is_moderator: true },
  { who: 'Somebody verified', is_verified: true },
  { who: 'Anybody else' },
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-10 text-white">
    {['text-sm', 'text-base', 'text-2xl'].map((size) => (
      <div key={size} className="space-y-2">
        {people.map((one) => (
          <p key={one.who} className={`flex items-center gap-1.5 font-bold ${size}`}>
            <span>{one.who}</span>
            <NameMarks person={one} />
          </p>
        ))}
      </div>
    ))}
    <div className="rounded-xl bg-ink-card p-4">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        made by <span className="font-bold text-white">@staw</span>
        <NameMarks person={{ is_admin: true, is_verified: true }} />
      </p>
    </div>
  </div>,
)
