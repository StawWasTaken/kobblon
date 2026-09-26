/*
 * The shared components with nothing around them.
 *
 * No router, no providers, no site — which is how Kobblon Workspace mounts
 * them. If this page renders, they travel; if it throws, one of them has
 * quietly grown a dependency on the website again, and the Workspace finds
 * out by its panel going blank.
 */
import { createRoot } from 'react-dom/client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Menu } from '@/components/ui/Menu'
import { Input } from '@/components/ui/Input'
import { Choices } from '@/components/ui/Choices'
import { Tooltip } from '@/components/ui/Tooltip'
import { kindLabels, uploadableKinds } from '@/lib/kinds'
import { faPen, faTrash } from '@fortawesome/free-solid-svg-icons'
import type { AssetKind } from '@/types/db'
import '@/index.css'

function Bare() {
  const [kind, setKind] = useState<AssetKind>('image')
  return (
    <div className="min-h-screen space-y-5 bg-ink p-8 text-white">
      <h1 className="font-display text-xl">Shared, with no website around it</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Button>Save</Button>
        <Button variant="brand">Kobblon</Button>
        <Button variant="enter">Play</Button>
        <Button variant="subtle">Cancel</Button>
        <Button variant="danger">Delete</Button>
        <Button to="/create">A link, with no router</Button>
      </div>

      <Choices
        value={kind}
        onChange={(next) => setKind(next as AssetKind)}
        options={uploadableKinds.map((one) => ({ value: one, label: kindLabels[one] }))}
      />

      <div className="max-w-sm"><Input label="A field" placeholder="Type here" /></div>

      <div className="flex items-center gap-3">
        <Menu
          label="What to do with it"
          trigger={<Button variant="subtle" size="sm">Menu</Button>}
          items={[
            { label: 'Edit', icon: faPen, onSelect: () => {} },
            { label: 'Delete', icon: faTrash, danger: true, onSelect: () => {} },
            { label: 'Open its page', to: '/create' },
          ]}
        />
        <Tooltip label="And a tooltip"><span className="text-white/60">hover me</span></Tooltip>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Bare />)
