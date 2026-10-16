/*
 * The five skin colours, on the body rather than in a row of squares.
 *
 * A swatch says what a colour is and a body says what it looks like on
 * somebody, and those are different questions: a tone that reads warm in a
 * 24-pixel square can read orange across a whole person. Staw gave these
 * five, so this page exists to look at them the way anybody choosing one
 * will.
 */
import { createRoot } from 'react-dom/client'
import { AvatarStage } from '@/components/avatar/AvatarStage'
import { Studio } from '@/components/avatar/Studio'
import '@/index.css'

const SKIN = ['#53463e', '#87674f', '#b39b8b', '#d29a72', '#ebb591']

const bodyOf = (skin: string) => ({
  Head: skin, Torso: '#1b34e8', LeftArm: skin,
  RightArm: skin, LeftLeg: '#2a2f45', RightLeg: '#2a2f45',
})

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-6 bg-ink p-8 text-white">
    <h1 className="font-display text-xl">The skin colours, worn</h1>
    <div className="grid w-[1200px] grid-cols-5 gap-5">
      {SKIN.map((skin) => (
        <div key={skin} className="space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted">{skin}</p>
          <div className="overflow-hidden rounded-2xl border border-ink-line">
            <Studio><AvatarStage look={{ body: bodyOf(skin), pieces: [] }} turning={false} /></Studio>
          </div>
        </div>
      ))}
    </div>
  </div>,
)
