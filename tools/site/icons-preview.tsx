import { createRoot } from 'react-dom/client'
import { faUser, faBell, faGear, faUsers } from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import '@/index.css'

const nav = [
  { icon: faUser, label: 'Profile' },
  { icon: faUsers, label: 'Friends' },
  { icon: faBell, label: 'Inbox' },
  { icon: faGear, label: 'Settings' },
]

createRoot(document.getElementById('root')!).render(
  <div className="flex gap-10 bg-chrome p-8 text-white">
    <div className="w-56 space-y-2">
      {nav.map((item) => (
        <div key={item.label} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold">
          <Glyph icon={item.icon} className="w-5 text-[15px]" />
          {item.label}
        </div>
      ))}
    </div>
    <div className="flex items-center gap-4">
      <Glyph icon={faUser} className="h-9 w-9" />
      <Glyph icon={faUser} />
      <Glyph icon={faUser} className="h-5" />
    </div>
  </div>,
)
