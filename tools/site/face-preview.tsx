/*
 * A face with nothing stored for it.
 *
 * Staw: "if theres no pfp then the avatar must render IMMEDIATELY". This is
 * that, on its own and with no providers around it - no auth, no router, no
 * theme - because the Workspace shows people too and a hook that throws
 * there is a panel that goes blank.
 *
 * With no database to reach, the look comes back empty and what draws is the
 * bare body, which is the honest answer to "what is this person wearing" in
 * a container that cannot ask.
 */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { Avatar } from '@/components/ui/Avatar'

const people = [
  { id: '11111111-1111-1111-1111-111111111111', display_name: 'Nothing stored' },
  { id: '22222222-2222-2222-2222-222222222222', display_name: 'A guest' },
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-10 text-white">
    {people.map((person) => (
      <div key={person.id} className="flex items-center gap-4">
        <Avatar personId={person.id} name={person.display_name} size="xl" />
        <Avatar personId={person.id} name={person.display_name} size="md" />
        <Avatar name="No person behind it" size="md" />
        <span className="text-sm">{person.display_name}</span>
      </div>
    ))}
  </div>,
)
