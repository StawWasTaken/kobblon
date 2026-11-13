/*
 * The two filters Discover grew, and the toggles the Creator Hub sets them
 * from, with no database behind either.
 *
 * Discover itself cannot be looked at without one: no database means
 * maintenance mode, which is the whole page. This mounts the controls on
 * their own - including the honest state of the location filter, which is
 * what it looks like until the Launcher starts saying where it opened a
 * server.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Select } from '@/components/ui/Select'
import { Glyph } from '@/components/brand/Glyph'
import { deviceIcons, deviceLabels, everyDevice, regionLabels } from '@/lib/kinds'
import type { WorldDevice } from '@/types/db'
import { cn } from '@/lib/cn'
import '@/index.css'

function Filters({ places }: { places: boolean }) {
  const [device, setDevice] = useState('any')
  const [region, setRegion] = useState('anywhere')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        label="What you are playing on"
        value={device}
        onChange={setDevice}
        className="w-44"
        options={[
          { value: 'any', label: 'Any device' },
          ...everyDevice.map((one) => ({ value: one, label: deviceLabels[one] })),
        ]}
      />
      <Select
        label="Where you would be playing"
        value={region}
        onChange={setRegion}
        className="w-52"
        disabled={!places}
        options={places
          ? [
            { value: 'anywhere', label: 'Anywhere' },
            { value: 'eu-west', label: regionLabels['eu-west'], note: '12 Worlds, 31 open' },
            { value: 'na-east', label: regionLabels['na-east'], note: '9 Worlds, 22 open' },
          ]
          : [{
            value: 'anywhere',
            label: 'No servers yet',
            note: 'Nowhere is reporting a location at the moment',
          }]}
      />
    </div>
  )
}

function Devices() {
  const [devices, setDevices] = useState<WorldDevice[]>(['computer', 'phone'])
  return (
    <div className="flex flex-wrap gap-2">
      {everyDevice.map((one) => {
        const on = devices.includes(one)
        const last = on && devices.length === 1
        return (
          <button
            key={one}
            type="button"
            aria-pressed={on}
            disabled={last}
            onClick={() => setDevices((was) => (
              was.includes(one) ? was.filter((x) => x !== one) : [...was, one]
            ))}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition-colors',
              on
                ? 'border-brand bg-brand/15 text-brand-bright'
                : 'border-ink-line text-muted hover:border-white/25 hover:text-white',
              last && 'cursor-default',
            )}
          >
            <Glyph icon={deviceIcons[one]} />
            {deviceLabels[one]}
          </button>
        )
      })}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-8 bg-ink p-8 text-white">
    <section>
      <h2 className="mb-3 font-display text-sm font-extrabold text-muted">
        Discover, with nowhere reporting a location
      </h2>
      <Filters places={false} />
    </section>
    <section>
      <h2 className="mb-3 font-display text-sm font-extrabold text-muted">
        Discover, once servers say where they are
      </h2>
      <Filters places />
    </section>
    <section>
      <h2 className="mb-3 font-display text-sm font-extrabold text-muted">
        The Creator Hub: what it runs on
      </h2>
      <Devices />
    </section>
  </div>,
)
