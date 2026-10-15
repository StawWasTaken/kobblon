/* Every Font Awesome icon the site asks for that Staw has drawn instead. */
import { createRoot } from 'react-dom/client'
import {
  faUser, faUsers, faUserGroup, faUserPlus, faUserMinus, faUserShield,
  faComment, faComments, faPaperPlane, faMicrophone, faMicrophoneSlash,
  faBullhorn, faThumbsUp, faThumbsDown, faStar, faHeart, faFlag, faBell,
  faGear, faCircleCheck, faTag, faTrophy, faHandPointer, faCircleUser,
  faUserXmark, faUserCheck,
} from '@fortawesome/free-solid-svg-icons'
import { Glyph } from '@/components/brand/Glyph'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Note } from '@/components/ui/Note'
import '@/index.css'

const SWAPPED = [
  ['faUser', faUser], ['faCircleUser', faCircleUser], ['faUsers', faUsers],
  ['faUserGroup', faUserGroup], ['faUserPlus', faUserPlus],
  ['faUserMinus', faUserMinus], ['faUserCheck', faUserCheck],
  ['faUserXmark', faUserXmark], ['faUserShield', faUserShield],
  ['faComment', faComment], ['faComments', faComments],
  ['faPaperPlane', faPaperPlane], ['faMicrophone', faMicrophone],
  ['faMicrophoneSlash', faMicrophoneSlash], ['faBullhorn', faBullhorn],
  ['faThumbsUp', faThumbsUp], ['faThumbsDown', faThumbsDown],
  ['faStar', faStar], ['faHeart', faHeart], ['faFlag', faFlag],
  ['faBell', faBell], ['faGear', faGear], ['faCircleCheck', faCircleCheck],
  ['faTag', faTag], ['faTrophy', faTrophy], ['faHandPointer', faHandPointer],
] as const

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-8 bg-ink p-10">
    <Note icon={faBell}>
      A Note, a Button and a Badge, none of which were touched: they take an
      icon from a call site and draw it through `Glyph`, so they are already
      Staw's.
    </Note>

    <div className="flex flex-wrap gap-2">
      <Button icon={faUserPlus}>Add a friend</Button>
      <Button variant="subtle" icon={faFlag}>Report</Button>
      <Button variant="ghost" icon={faGear}>Settings</Button>
      <Button variant="yes" icon={faThumbsUp}>Like it</Button>
      <Badge tone="space"><Glyph icon={faStar} className="mr-1" />Starred</Badge>
    </div>

    <div className="flex flex-wrap gap-4">
      {SWAPPED.map(([name, icon]) => (
        <div key={name} className="w-28 text-center">
          <div className="grid h-16 place-items-center rounded-xl border border-ink-line bg-ink-card text-2xl">
            <Glyph icon={icon} />
          </div>
          <p className="mt-1 truncate text-[10px] text-muted">{name}</p>
        </div>
      ))}
    </div>
  </div>,
)
