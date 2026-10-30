import { useEffect, useState } from 'react'
import { TipBubble } from '@/components/ui/Tooltip'

/**
 * Every hover tip on this platform is ours, including the ones nobody wrote
 * a component for.
 *
 * Staw: "i want that every hover tooltip are our own custom ones". There
 * were a hundred and thirty-seven plain `title` attributes across the
 * website, which the browser draws in its own grey box, in its own font,
 * after its own second and a half - three things we do not control and
 * cannot make match. Wrapping each one in `<Tooltip>` would have been a
 * hundred and thirty-seven edits that the next `title` somebody writes is
 * not covered by, and the components the Workspace mounts would have
 * carried their own copy of the decision.
 *
 * So this is one layer, mounted once, and the rule is the attribute rather
 * than the component: anything with a `title` gets our bubble, wherever it
 * came from and whoever wrote it.
 *
 * How the browser's own box is kept out of the way: on the way in, the
 * `title` is moved to `data-tip` on that element. The browser has nothing
 * to draw from, we have the words, and a later render that writes `title`
 * again is picked up the next time somebody hovers - the native attribute
 * is read first every time, so a label that changes is never stale.
 *
 * What it deliberately leaves alone: `<title>` inside an SVG, which is an
 * element and not an attribute, and an `<iframe title>`, which names the
 * frame rather than describing it. Both are accessibility text with no
 * hover behaviour to replace.
 */
export function TitleTips() {
  const [tip, setTip] = useState<{ rect: DOMRect; label: string } | null>(null)

  useEffect(() => {
    let held: HTMLElement | null = null
    let timer: number | undefined

    const drop = () => {
      window.clearTimeout(timer)
      if (held) held.removeAttribute('aria-describedby')
      held = null
      setTip(null)
    }

    const wanted = (from: EventTarget | null): HTMLElement | null => {
      if (!(from instanceof Element)) return null
      const found = from.closest('[title], [data-tip]')
      if (!(found instanceof HTMLElement)) return null
      if (found.tagName === 'IFRAME') return null
      return found
    }

    const over = (event: Event) => {
      const el = wanted(event.target)
      if (!el) { if (held) drop(); return }
      if (el === held) return

      drop()

      /*
       * The native attribute wins over whatever was stashed last time, so a
       * label React has just rewritten is the one shown - the trap this
       * project keeps falling into is a value read once and kept, and a
       * tooltip holding last hour's number is exactly that shape.
       */
      const native = el.getAttribute('title')
      if (native !== null) {
        if (native.trim()) el.setAttribute('data-tip', native)
        else el.removeAttribute('data-tip')
        el.removeAttribute('title')
      }

      const label = el.getAttribute('data-tip') ?? ''
      if (!label.trim()) return

      held = el
      timer = window.setTimeout(() => {
        if (held !== el || !el.isConnected) return
        el.setAttribute('aria-describedby', 'hover-tip')
        setTip({ rect: el.getBoundingClientRect(), label })
      }, 120)
    }

    const out = (event: Event) => {
      // Moving onto a child of the same thing is not leaving it; without
      // this, a tip over a button with an icon in it flickers.
      const to = (event as PointerEvent).relatedTarget
      if (held && to instanceof Node && held.contains(to)) return
      drop()
    }

    document.addEventListener('pointerover', over, true)
    document.addEventListener('pointerout', out, true)
    document.addEventListener('focusin', over, true)
    document.addEventListener('focusout', drop, true)
    document.addEventListener('pointerdown', drop, true)
    window.addEventListener('scroll', drop, true)
    window.addEventListener('resize', drop)

    return () => {
      drop()
      document.removeEventListener('pointerover', over, true)
      document.removeEventListener('pointerout', out, true)
      document.removeEventListener('focusin', over, true)
      document.removeEventListener('focusout', drop, true)
      document.removeEventListener('pointerdown', drop, true)
      window.removeEventListener('scroll', drop, true)
      window.removeEventListener('resize', drop)
    }
  }, [])

  return <TipBubble anchor={tip?.rect ?? null} label={tip?.label ?? ''} id="hover-tip" />
}
