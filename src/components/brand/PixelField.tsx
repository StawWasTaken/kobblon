import { useEffect, useRef } from 'react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { cn } from '@/lib/cn'

const BRAND = [27, 52, 232]
/*
 * A second set of cells, for a small field rather than a whole page.
 *
 * Brand blue over a near-black bar, at a quarter of the alpha, through a
 * mask, in a strip two centimetres tall: the canvas draws, the pixels are
 * measurably there, and nobody can see them. A wash behind a whole hero has
 * the room to be that quiet; a corner of a bar does not. So the small
 * version is a pale blue lit towards white - the same grid with the contrast
 * its surface actually leaves it.
 */
const PALE = [150, 176, 255]

/**
 * The pixel wash behind the homepage welcome. It is a coarse grid of brand
 * blue cells lit by two slow diagonal waves, so it reads as something built
 * out of pixels rather than a particle cloud. It draws on a downscaled
 * canvas at ~20fps and pauses whenever it is off screen.
 */
export function PixelField({ className, tone = 'brand' }: {
  className?: string
  /** 'brand' is the wash behind a hero; 'pale' is the one that has to read
   * in a strip the size of a bar. */
  tone?: 'brand' | 'pale'
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = useReducedMotion()

  const small = tone === 'pale'
  const cell = small ? PALE : BRAND
  const lit = small ? [226, 234, 255] : [90, 116, 255]
  /* A smaller square in a strip, so there are rows of them rather than
   * three and a half. */
  const CELL = small ? 10 : 14

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) return

    let width = 0
    let height = 0
    let columns = 0
    let rows = 0

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.round(rect.width))
      height = Math.max(1, Math.round(rect.height))
      columns = Math.ceil(width / CELL)
      rows = Math.ceil(height / CELL)
      canvas.width = width
      canvas.height = height
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)
      const t = time / 1000

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < columns; x++) {
          const wave =
            Math.sin((x * 0.32) + (y * 0.18) - t * 1.1) * 0.5 +
            Math.sin((x * 0.11) - (y * 0.26) + t * 0.7) * 0.5
          /*
           * Fade out towards the bottom so the headline under the wash
           * stays readable. A bar has no headline under it and only four
           * rows to spend, so a falloff there empties three of them: the
           * small version keeps its full height and is faded sideways by
           * the mask on the element instead.
           */
          const falloff = small ? 1 : 1 - y / rows
          const level = (wave * 0.5 + 0.5) * falloff

          if (level < 0.32) continue
          const alpha = (level - 0.32) * (small ? 1.5 : 0.85)
          ctx.fillStyle = `rgba(${cell[0]}, ${cell[1]}, ${cell[2]}, ${alpha.toFixed(3)})`
          // the occasional brighter cell keeps the grid from looking uniform
          if (level > 0.88) ctx.fillStyle = `rgba(${lit[0]}, ${lit[1]}, ${lit[2]}, ${(alpha * 0.9).toFixed(3)})`
          ctx.fillRect(x * CELL, y * CELL, CELL - 2, CELL - 2)
        }
      }
    }

    resize()

    if (reduced) {
      draw(0)
      return
    }

    let frame = 0
    let last = 0
    let running = true

    const loop = (time: number) => {
      if (time - last > 50) {
        draw(time)
        last = time
      }
      if (running) frame = requestAnimationFrame(loop)
    }

    const observer = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting
      if (running) frame = requestAnimationFrame(loop)
      else cancelAnimationFrame(frame)
    })
    observer.observe(canvas)

    const onResize = () => resize()
    window.addEventListener('resize', onResize)

    return () => {
      running = false
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [reduced, tone, small, CELL])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 h-full w-full', className)}
    />
  )
}
