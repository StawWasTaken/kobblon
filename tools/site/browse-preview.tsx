/*
 * The shared top of Communities, Discover and the Catalog, on its own.
 *
 * Mounted with nothing around it, because the three pages that use it all
 * need a database and this container cannot reach one - and because the
 * Workspace may want the same panel later, which means it has to survive
 * outside a page.
 */
import { useState } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { createRoot } from 'react-dom/client'
import { faShirt, faCompass, faUsers } from '@fortawesome/free-solid-svg-icons'
import { BrowseHero, ChipRail } from '@/components/browse/BrowseHero'
import { Button } from '@/components/ui/Button'
import '@/index.css'

const WORDS = [
  'accessory', 'ninja', 'halloween', 'fighting', 'headband', 'scary', 'black',
  'green', 'cosplay', 'zombie', 'dreads', 'emotes', 'face', 'monkey', 'beard',
]

function One() {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [c, setC] = useState('zombie')

  return (
    <div className="mx-auto max-w-[86rem] space-y-8 p-6">
      <BrowseHero
        title="Catalog"
        lead="Everything you can put on an avatar - shirts, hair, faces, whole outfits."
        icon={faShirt}
        value={c}
        onChange={setC}
        placeholder="Search the Catalog"
        actions={<><Button variant="subtle">My Avatar</Button><Button>Make one</Button></>}
      >
        <ChipRail className="mt-4" words={WORDS} value={c} onPick={setC} />
      </BrowseHero>

      <BrowseHero
        title="Discover"
        lead="What people are building and playing right now."
        icon={faCompass}
        value={a}
        onChange={setA}
        placeholder="Search Worlds by name"
      />

      <BrowseHero
        title="Communities"
        lead="Fan clubs, build teams, hobby corners."
        icon={faUsers}
        value={b}
        onChange={setB}
        placeholder="Search every Community"
        actions={<Button>Make one</Button>}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <MemoryRouter><div className="min-h-screen bg-ink text-ink-strong"><One /></div></MemoryRouter>,
)
