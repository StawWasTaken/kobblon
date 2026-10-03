/*
 * What somebody has put aside in the Catalog.
 *
 * It lives in the browser rather than in a table, deliberately: a basket's
 * whole life is one visit, and a row per person per item would be a schema
 * carrying a feeling. What it holds is ids and enough to draw a line in a
 * list; the price shown when the basket is opened is read from the server
 * again, because a price in a browser is a price from whenever that tab was
 * opened.
 *
 * Shared through a listener list rather than a provider so a header and a
 * page can both hold it. A provider would mean the component cannot be
 * mounted on its own, which is the rule shared pieces here live by.
 */
import { useEffect, useState } from 'react'

const KEY = 'kobblon.basket'
const MOST = 24

export type BasketLine = {
  id: string
  name: string
  kind: string
  price: number
  picture?: string | null
}

let held: BasketLine[] = read()
const listening = new Set<(lines: BasketLine[]) => void>()

function read(): BasketLine[] {
  try {
    const raw = localStorage.getItem(KEY)
    const found = raw ? JSON.parse(raw) : []
    return Array.isArray(found) ? found.slice(0, MOST) : []
  } catch {
    // A browser with storage turned off still gets a basket; it just forgets
    // it when the tab closes, which is better than a Catalog that throws.
    return []
  }
}

function write(lines: BasketLine[]) {
  held = lines
  try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* see above */ }
  for (const tell of listening) tell(lines)
}

export const basketHolds = (id: string) => held.some((one) => one.id === id)

export function putInBasket(line: BasketLine) {
  if (held.some((one) => one.id === line.id)) return
  if (held.length >= MOST) return
  write([...held, line])
}

export const takeOutOfBasket = (id: string) =>
  write(held.filter((one) => one.id !== id))

export const emptyBasket = () => write([])

/** The basket, and it re-renders whoever is watching when it changes. */
export function useBasket() {
  const [lines, setLines] = useState<BasketLine[]>(held)
  useEffect(() => {
    listening.add(setLines)
    // Whatever it is now, in case it changed between the first render and
    // this running - the thing this project keeps getting wrong is a value
    // read once before the thing that decides it has finished.
    setLines(held)
    return () => { listening.delete(setLines) }
  }, [])
  return lines
}

export const BASKET_MOST = MOST
