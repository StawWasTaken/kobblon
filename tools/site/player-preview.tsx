/*
 * Both modes of the one player, side by side.
 *
 * The mute fix moved ownership of `muted` out of VolumeControl, which every
 * video on the site uses - so the ordinary player has to be looked at too,
 * not just the advert it was changed for.
 */
import { createRoot } from 'react-dom/client'
import { MediaPlayer } from '@/components/create/MediaPlayer'
import '@/index.css'

const clip = '/brand/kobblon-its-free.mp4'

createRoot(document.getElementById('root')!).render(
  <div className="min-h-screen space-y-8 bg-ink p-8 text-white">
    <div className="space-y-2">
      <h2 className="font-display text-sm uppercase tracking-wider text-muted">
        Ordinary — as an item page uses it
      </h2>
      <MediaPlayer kind="video" src={clip} className="max-w-xl" />
    </div>
    <div className="space-y-2">
      <h2 className="font-display text-sm uppercase tracking-wider text-muted">
        Ambient — as the front page uses it
      </h2>
      <MediaPlayer kind="video" ambient src={clip} className="max-w-xl" />
    </div>
    <div className="space-y-2">
      <h2 className="font-display text-sm uppercase tracking-wider text-muted">Audio</h2>
      <MediaPlayer kind="audio" src={clip} className="max-w-xl" />
    </div>
  </div>,
)
