/*
 * Two things at once, both of them Staw's.
 *
 * A face with nothing stored for it draws itself, and a face on a head is
 * bent round the head. Neither has a provider around it - no auth, no
 * router, no theme - because the Workspace shows people too, and a hook that
 * throws there is a panel that goes blank.
 *
 * The faces below are drawn here rather than fetched: one filling its file
 * edge to edge and one small in the middle of a wide margin, which is the
 * real reason two faces used to look like two different sizes on two bodies.
 * On the heads they are the same size.
 */
import { createRoot } from 'react-dom/client'
import '@/index.css'
import { Avatar } from '@/components/ui/Avatar'
import { AvatarStage } from '@/components/avatar/AvatarStage'
import { Studio } from '@/components/avatar/Studio'

const face = (wide: number, high: number, margin: number) => {
  const eye = (at: number) =>
    `<ellipse cx="${at}" cy="${high * 0.42}" rx="${wide * 0.07}" ry="${high * 0.1}" fill="#1b1b22"/>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${wide}" height="${high}">`
    + `<g transform="translate(${margin} ${margin}) scale(${(wide - margin * 2) / wide} ${(high - margin * 2) / high})">`
    + eye(wide * 0.33) + eye(wide * 0.67)
    + `<path d="M ${wide * 0.3} ${high * 0.62} Q ${wide * 0.5} ${high * 0.8} ${wide * 0.7} ${high * 0.62}"`
    + ` stroke="#1b1b22" stroke-width="${wide * 0.05}" fill="none" stroke-linecap="round"/>`
    + `</g></svg>`,
  )}`
}

const body = {
  Head: '#f3c98b', Torso: '#2f6df6', LeftArm: '#f3c98b',
  RightArm: '#f3c98b', LeftLeg: '#2b3550', RightLeg: '#2b3550',
}

const looks = [
  { name: 'Drawn edge to edge', picture: face(256, 256, 0) },
  { name: 'Drawn small in a wide margin', picture: face(256, 256, 70) },
]

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-8 bg-ink p-10 text-white">
    <div className="flex gap-6">
      {looks.map((one) => (
        <figure key={one.name} className="w-72">
          <div className="aspect-square rounded-2xl border border-ink-line bg-ink-card">
            <AvatarStage
              look={{ body, pieces: [{ slot: 'face', kind: 'face', imageUrl: one.picture }] }}
              turning={false}
            />
          </div>
          <figcaption className="mt-2 text-sm text-muted">{one.name}</figcaption>
        </figure>
      ))}
    </div>

    {/* The profile page's figure at its own size, so the proportion of the
        studio card is looked at rather than guessed. */}
    <div className="flex gap-5">
      <Studio className="aspect-[3/4] w-56 rounded-2xl border border-ink-line">
        <AvatarStage
          look={{ body, pieces: [{ slot: 'face', kind: 'face', imageUrl: looks[0].picture }] }}
          turning={false}
        />
      </Studio>
      <div className="min-w-0 flex-1">
        <h1 className="font-display text-3xl font-extrabold">Somebody</h1>
        <p className="mt-1.5 text-sm text-muted">@somebody</p>
      </div>
    </div>

    <div className="flex items-center gap-4">
      <Avatar personId="11111111-1111-1111-1111-111111111111" name="Nothing stored" size="xl" />
      <Avatar personId="11111111-1111-1111-1111-111111111111" name="Nothing stored" size="md" />
      <Avatar name="No person behind it" size="md" />
      <span className="text-sm">A face with nothing stored, drawn from the avatar</span>
    </div>
  </div>,
)
