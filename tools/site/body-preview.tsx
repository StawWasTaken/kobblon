/* The body picker, with nothing around it and nothing to sign in to. */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BodyPicker, BODY_LABELS } from '@/components/avatar/BodyPicker'
import type { BodyPart } from '@/engine'
import { Card } from '@/components/ui/Card'
import '@/index.css'

const COLOURS: Record<string, string> = {
  Head: '#f2d08a', Torso: '#1b34e8', LeftArm: '#f2d08a',
  RightArm: '#f2d08a', LeftLeg: '#2a2f45', RightLeg: '#2a2f45',
}

const SHELF = [
  '#1b34e8', '#3a50ff', '#4f8cff', '#00c2d6', '#1cae71', '#25d68c',
  '#8ee34a', '#e8c91b', '#ffb020', '#ff8a1b', '#ff0033', '#ff4d7e',
]

function Panel() {
  const [parts, setParts] = useState<BodyPart[]>(['LeftArm', 'RightArm'])

  return (
    <Card className="max-w-4xl p-5">
      <div className="grid gap-6 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:items-start">
        <div className="rounded-2xl border border-ink-line bg-ink-raised p-5">
          <BodyPicker
            colours={COLOURS}
            chosen={parts}
            className="mx-auto max-w-[15rem]"
            onChoose={(one) => setParts((had) => (
              had.includes(one) ? had.filter((x) => x !== one) : [...had, one]
            ))}
          />
        </div>
        <div className="min-w-0 space-y-4">
          <p className="font-display text-lg font-extrabold">
            {parts.length === 1 ? BODY_LABELS[parts[0]] : `${parts.length} parts`}
          </p>
          <div className="flex flex-wrap gap-2">
            {SHELF.map((colour) => (
              <span
                key={colour}
                className="h-10 w-10 rounded-xl border-2 border-ink-line"
                style={{ background: colour }}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen bg-ink p-10">
    <Panel />
  </div>,
)
