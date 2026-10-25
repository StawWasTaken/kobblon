import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export type TextSize = 'minimalist' | 'default' | 'comfortable'

export const TEXT_SIZES: TextSize[] = ['minimalist', 'default', 'comfortable']

const KEY = 'kobblon.text'

const TextSizeContext = createContext<{
  size: TextSize
  setSize: (next: TextSize) => void
}>({
  size: 'default',
  setSize: () => {},
})

const stored = (): TextSize => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && (TEXT_SIZES as string[]).includes(saved)) return saved as TextSize
  } catch {
    // private windows and blocked storage both land here; the default is fine
  }
  return 'default'
}

/**
 * How big the interface is, kept on this device.
 *
 * It is one lever rather than a font-size box and a spacing box, because
 * Tailwind's type and spacing scales are both in `rem`: the root size is
 * the only number either of them is measured against, so moving it moves
 * the text and the room around it together and nothing drifts out of
 * proportion. The breakpoints are in pixels, so a phone stays a phone on
 * Comfortable and a laptop does not fall back to the narrow layout.
 *
 * The sizes themselves are percentages of whatever the browser is set to,
 * not pixels - somebody who has turned their own text up keeps that, and
 * Minimalist is smaller than their size rather than smaller than ours.
 */
export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [size, setSizeState] = useState<TextSize>(stored)

  useEffect(() => {
    document.documentElement.dataset.text = size
  }, [size])

  const value = useMemo(() => ({
    size,
    setSize: (next: TextSize) => {
      setSizeState(next)
      try { localStorage.setItem(KEY, next) } catch { /* nothing to do */ }
    },
  }), [size])

  return <TextSizeContext.Provider value={value}>{children}</TextSizeContext.Provider>
}

export const useTextSize = () => useContext(TextSizeContext)
