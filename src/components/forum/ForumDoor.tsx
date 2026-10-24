import { useEffect, useRef, useState } from 'react'
import { useNavigationType } from 'react-router-dom'
import { useReducedMotion } from '@/hooks/useReducedMotion'

/**
 * The door into the forum.
 *
 * Staw: "like the dots moving before u enter the forum". So the forum does
 * not simply appear: a field of dots flies in from everywhere, settles into
 * the grid Kobblon is drawn out of, and lifts.
 *
 * Why it is a canvas and not two hundred divs with a transition on each:
 * two hundred animating elements is two hundred composited layers and a
 * first paint that stutters on exactly the machine this is meant to look
 * good on. One canvas is one layer.
 *
 * **Not on a cold load.** Arriving at kobblon.com/forum from a link, the
 * site's own boot screen has already covered the arrival, and a second
 * curtain the moment it lifts is two animations in a row before anybody
 * has read a word. So the door plays when the forum is *entered* - a link
 * followed from inside the site, which is what `PUSH` means - and not when
 * the browser loaded the page. Back and forward are `POP` too, and a
 * curtain on the back button is a curtain in somebody's way.
 *
 * **Once a session, and never for somebody who asked for less motion.** A
 * curtain that comes down every time you follow a link inside the forum is
 * a curtain between you and the thread you were reading - which is the
 * difference between an entrance and an obstacle. `sessionStorage` is the
 * right memory for it: it lasts as long as the visit and not a minute
 * longer, so coming back tomorrow is an arrival again.
 */
const SEEN = 'kob.forum.door'

function alreadyIn() {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    /* A private window, or storage somebody has blocked. The door simply
       opens every time, which is a worse experience and not a broken one. */
    return false
  }
}

type Dot = {
  /* Where it is going: its place in the grid. */
  homeX: number
  homeY: number
  /* Where it came in from, and how far along it is. */
  fromX: number
  fromY: number
  delay: number
  size: number
  bright: boolean
}

const CELL = 34
const BRAND = '27, 52, 232'
const RUN = 1150

/** Slow at both ends, which is what makes the settling read as arriving. */
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)

export function ForumDoor() {
  const reduced = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  /*
   * Decided once, at mount, from storage - not read again on every render.
   * The value that decides this changes the moment the door opens, and a
   * component that re-reads it mid-flight closes its own curtain.
   */
  const how = useNavigationType()
  const [open, setOpen] = useState(() => how === 'PUSH' && !alreadyIn() && !reduced)
  const [lifting, setLifting] = useState(false)

  useEffect(() => {
    if (!open) return
    try { sessionStorage.setItem(SEEN, '1') } catch { /* see above */ }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) { setOpen(false); return }

    let width = 0
    let height = 0
    let dots: Dot[] = []

    const lay = () => {
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width
      canvas.height = height

      const columns = Math.ceil(width / CELL) + 1
      const rows = Math.ceil(height / CELL) + 1
      const middleX = width / 2
      const middleY = height / 2

      dots = []
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
          const homeX = x * CELL + CELL / 2
          const homeY = y * CELL + CELL / 2
          /*
           * Every dot comes in along the line it will end up on, from off
           * the edge of the screen. Pushing them out from the middle rather
           * than scattering them at random is what makes the field read as
           * one thing arriving instead of confetti.
           */
          const awayX = homeX - middleX
          const awayY = homeY - middleY
          const far = Math.hypot(awayX, awayY) || 1
          const reach = Math.max(width, height) * 1.15
          dots.push({
            homeX,
            homeY,
            fromX: homeX + (awayX / far) * reach,
            fromY: homeY + (awayY / far) * reach,
            /* The middle lands first, so it opens outwards. */
            delay: (far / reach) * 420,
            size: 3 + (x * 7 + y * 13) % 3,
            bright: (x * 31 + y * 17) % 11 === 0,
          })
        }
      }
    }

    lay()

    const began = performance.now()
    let frame = 0

    const draw = (now: number) => {
      const gone = now - began
      ctx.clearRect(0, 0, width, height)

      for (const dot of dots) {
        const along = Math.min(1, Math.max(0, (gone - dot.delay) / RUN))
        const eased = ease(along)
        const x = dot.fromX + (dot.homeX - dot.fromX) * eased
        const y = dot.fromY + (dot.homeY - dot.fromY) * eased
        /* They fade as they settle, so the grid dissolves into the page
           rather than sitting on top of it waiting to be removed. */
        const alpha = along < 0.75 ? 0.75 : 0.75 * (1 - (along - 0.75) / 0.25)
        if (alpha <= 0) continue
        ctx.fillStyle = dot.bright
          ? `rgba(90, 116, 255, ${alpha.toFixed(3)})`
          : `rgba(${BRAND}, ${alpha.toFixed(3)})`
        ctx.fillRect(x - dot.size / 2, y - dot.size / 2, dot.size, dot.size)
      }

      if (gone < RUN + 520) {
        frame = requestAnimationFrame(draw)
      } else {
        setOpen(false)
      }
      /* The backdrop goes before the dots do, so the page is already there
         behind the last of them. */
      if (gone > RUN * 0.45) setLifting(true)
    }

    frame = requestAnimationFrame(draw)
    window.addEventListener('resize', lay)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', lay)
    }
  }, [open])

  if (!open) return null

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[70]"
    >
      <div
        className="absolute inset-0 bg-ink transition-opacity duration-700"
        style={{ opacity: lifting ? 0 : 1 }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
