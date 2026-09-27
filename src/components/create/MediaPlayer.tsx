import { useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPlay, faPause, faVolumeHigh, faVolumeXmark, faRotateRight,
} from '@fortawesome/free-solid-svg-icons'
import { cn } from '@/lib/cn'

const clock = (seconds: number) => {
  if (!Number.isFinite(seconds)) return '0:00'
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** The bar you drag. Keyboard driven as well, because it is a real control. */
function Scrubber({
  value, max, buffered, onSeek, label,
}: {
  value: number
  max: number
  buffered: number
  onSeek: (next: number) => void
  label: string
}) {
  const track = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const seekTo = (clientX: number) => {
    const box = track.current?.getBoundingClientRect()
    if (!box || !max) return
    onSeek(Math.min(Math.max((clientX - box.left) / box.width, 0), 1) * max)
  }

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => seekTo(e.clientX)
    const up = () => setDragging(false)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, max])

  const pct = max ? (value / max) * 100 : 0
  const loaded = max ? (buffered / max) * 100 : 0

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
      aria-valuetext={clock(value)}
      onPointerDown={(e) => { setDragging(true); seekTo(e.clientX) }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(value + 5, max)) }
        if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(value - 5, 0)) }
        if (e.key === 'Home') { e.preventDefault(); onSeek(0) }
        if (e.key === 'End') { e.preventDefault(); onSeek(max) }
      }}
      className="group/bar relative h-6 flex-1 cursor-pointer touch-none select-none"
    >
      <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/15" />
      <span
        className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/25"
        style={{ width: `${loaded}%` }}
      />
      <span
        className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-brand-bright"
        style={{ width: `${pct}%` }}
      />
      <span
        className={cn(
          'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow transition-transform',
          dragging ? 'scale-125' : 'scale-0 group-hover/bar:scale-100',
        )}
        style={{ left: `${pct}%` }}
      />
    </div>
  )
}

/*
 * The volume, owned by the player rather than by this control.
 *
 * It used to keep its own `muted`, defaulting to false, and write it to the
 * element whenever the element changed. Which meant two components owned one
 * property: the player muted an ambient clip, this unmuted it a moment
 * later, and the clip played with sound nobody asked for - or, once the
 * browser refused that, did not play at all. Both halves were correct on
 * their own, which is why it took a trace to see.
 */
function VolumeControl({ media, muted, onMuted }: {
  media: HTMLMediaElement | null
  muted: boolean
  onMuted: (next: boolean) => void
}) {
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    if (!media) return
    media.volume = volume
  }, [media, volume])

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onMuted(!muted)}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="grid h-8 w-8 place-items-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <FontAwesomeIcon icon={muted || volume === 0 ? faVolumeXmark : faVolumeHigh} />
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={muted ? 0 : volume}
        onChange={(e) => { setVolume(Number(e.target.value)); onMuted(false) }}
        aria-label="Volume"
        className="hidden h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-white/15 accent-[#3A50FF] sm:block"
      />
    </div>
  )
}

/**
 * Our own player for sound and video. It never offers the file: there is no
 * download control, no context menu on the picture, and the source it plays
 * from is a link that expires.
 */
export function MediaPlayer({
  src, kind, poster, className, ambient = false,
}: {
  src: string | null
  kind: 'audio' | 'video'
  poster?: string | null
  className?: string
  /**
   * Plays by itself, silently, on a loop, and a click turns the sound on
   * rather than pausing it. For a clip that is there to be glanced at - the
   * advert on the front page - where a still frame with a play button on it
   * is an invitation most people decline.
   *
   * Silent is not a style choice: a browser will refuse to start a clip
   * with sound that nobody asked for, and refusing is the whole reason a
   * muted autoplay is allowed at all. So the sound is the thing the click
   * buys, and until then the picture moves and says nothing.
   */
  ambient?: boolean
}) {
  const media = useRef<HTMLVideoElement & HTMLAudioElement>(null)
  const [node, setNode] = useState<HTMLMediaElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [length, setLength] = useState(0)
  const [buffered, setBuffered] = useState(0)
  const [ended, setEnded] = useState(false)
  const [muted, setMuted] = useState(ambient)
  // A clip is shown in its own shape rather than posted into a widescreen
  // box, so nothing is letterboxed that was never wide.
  const [shape, setShape] = useState<{ w: number; h: number } | null>(null)

  useEffect(() => { setShape(null); setTime(0); setEnded(false) }, [src])

  useEffect(() => { setNode(media.current) }, [src])

  /*
   * An ambient clip starts when it comes into view and stops when it leaves.
   * Not on load: the front page's advert is well below the fold, and a
   * five-megabyte download that begins before anybody has scrolled to it is
   * paid for by everybody who never does.
   *
   * It also stops when scrolled past, because a film playing to nobody in a
   * background tab is somebody's battery.
   */
  useEffect(() => {
    const element = media.current
    if (!ambient || !element || !src) return

    element.muted = true
    const watcher = new IntersectionObserver(
      ([seen]) => {
        if (seen.isIntersecting) void element.play().catch(() => {})
        else element.pause()
      },
      { threshold: 0.25 },
    )
    watcher.observe(element)
    return () => watcher.disconnect()
  }, [ambient, src])

  /*
   * Written to the element as well as rendered, because a clip that is not
   * muted at the instant `play()` is called is refused outright - which
   * shows up as autoplay quietly not happening, with nothing in the
   * console to say why.
   */
  useEffect(() => {
    if (media.current) media.current.muted = muted
  }, [muted, src])

  /** In ambient mode a click buys the sound; everywhere else it pauses. */
  const press = () => {
    if (!ambient) { toggle(); return }
    const element = media.current
    if (!element) return
    setMuted((was) => !was)
    // Unmuting something the browser had stopped should also start it.
    if (element.paused) void element.play().catch(() => {})
  }

  const toggle = () => {
    const element = media.current
    if (!element) return
    if (element.paused) { void element.play(); setEnded(false) } else element.pause()
  }

  const shared = {
    ref: media,
    src: src ?? undefined,
    /*
     * An ambient clip fetches nothing until it is scrolled to, which is what
     * the observer above is for. Everywhere else metadata is wanted up
     * front, because that is where the duration on the scrubber comes from
     * and a player showing 0:00 until you press it looks broken.
     */
    preload: ambient ? ('none' as const) : ('metadata' as const),
    loop: ambient,
    /*
     * `muted` is written to the element and never read back into state.
     *
     * It was both for a while, and the two fought: React mounts the element
     * unmuted, that fires a volumechange, the handler faithfully read "not
     * muted" back into the state whose whole job was to mute it, and the
     * effect then obediently unmuted the element. Everything worked exactly
     * as written and the clip sat there unmuted with no prompt offering the
     * sound - `loop` and `preload` proved ambient mode was on, which is how
     * it was found.
     *
     * So this is one-way now. `press` is the only thing that changes it.
     */
    muted,
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => { setPlaying(false); setEnded(true) },
    onTimeUpdate: () => setTime(media.current?.currentTime ?? 0),
    onLoadedMetadata: () => {
      const element = media.current
      setLength(element?.duration ?? 0)
      if (element?.videoWidth && element?.videoHeight) {
        setShape({ w: element.videoWidth, h: element.videoHeight })
      }
    },
    onProgress: () => {
      const element = media.current
      if (element?.buffered.length) setBuffered(element.buffered.end(element.buffered.length - 1))
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  }

  const controls = (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <button
        onClick={toggle}
        disabled={!src}
        aria-label={playing ? 'Pause' : 'Play'}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-[#fff] transition-colors hover:bg-brand-bright disabled:opacity-40"
      >
        <FontAwesomeIcon
          icon={ended ? faRotateRight : playing ? faPause : faPlay}
          className={cn(!playing && !ended && 'translate-x-px')}
        />
      </button>

      <span className="w-10 shrink-0 text-xs tabular-nums text-white/70">{clock(time)}</span>

      <Scrubber
        value={time}
        max={length}
        buffered={buffered}
        label="Seek"
        onSeek={(next) => {
          if (media.current) media.current.currentTime = next
          setTime(next)
        }}
      />

      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-white/70">
        {clock(length)}
      </span>

      <VolumeControl media={node} muted={muted} onMuted={setMuted} />
    </div>
  )

  if (kind === 'audio') {
    return (
      <div className={cn('rounded-xl border border-ink-line bg-ink-raised', className)}>
        <audio {...shared} className="hidden" />
        {controls}
      </div>
    )
  }

  return (
    <div
      // The menu is blocked over the whole picture, not only the video
      // element, so pausing does not open a way to save the file.
      onContextMenu={(e) => e.preventDefault()}
      className={cn('overflow-hidden rounded-xl border border-ink-line bg-black', className)}
    >
      <div className="relative">
        <video
          {...shared}
          poster={poster ?? undefined}
          playsInline
          disablePictureInPicture
          controlsList="nodownload noplaybackrate"
          onClick={press}
          style={{ aspectRatio: shape ? `${shape.w} / ${shape.h}` : '16 / 9' }}
          className="w-full cursor-pointer select-none bg-black object-contain"
        />
        {/*
          * In ambient mode the picture is already moving, so the overlay is
          * a small note about the sound rather than a sheet over the whole
          * clip with a play button on it - covering a playing film to tell
          * somebody they could play it.
          */}
        {ambient && muted && (
          <button
            onClick={press}
            aria-label="Turn the sound on"
            onContextMenu={(e) => e.preventDefault()}
            className="group absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-ink/75 px-3.5 py-2 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-brand"
          >
            <FontAwesomeIcon icon={faVolumeXmark} />
            Tap for sound
          </button>
        )}

        {!ambient && !playing && (
          <button
            onClick={toggle}
            aria-label="Play"
            onContextMenu={(e) => e.preventDefault()}
            className="absolute inset-0 grid place-items-center bg-black/30 transition-colors hover:bg-black/20"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand text-[#fff] shadow-pop">
              <FontAwesomeIcon icon={ended ? faRotateRight : faPlay} className="text-xl" />
            </span>
          </button>
        )}
      </div>
      <div className="bg-ink-raised">{controls}</div>
    </div>
  )
}
