import { useEffect } from 'react'
import { asset } from '@/lib/asset'

const DEFAULT_TITLE = 'Kobblon'
const DEFAULT_ICON = asset('/brand/favicon.png')

/** Create has a mark of its own, and every page of it wears it. */
export const CREATE_ICON = asset('/brand/favicon-create.png')

/**
 * What the browser tab says. Every page names itself, and the name goes back
 * to plain Kobblon when you leave. Parts of the site that have a name of
 * their own pass it as the second argument, so a page inside Create reads
 * "My Uploads - Kobblon Create" rather than stacking both names.
 */
export function useTitle(title?: string | null, site: string = DEFAULT_TITLE) {
  useEffect(() => {
    document.title = title ? `${title} - ${site}` : site
    return () => { document.title = DEFAULT_TITLE }
  }, [title, site])
}

/** A title that is already written in full, used where the pattern differs. */
export function useExactTitle(title?: string | null) {
  useEffect(() => {
    document.title = title || DEFAULT_TITLE
    return () => { document.title = DEFAULT_TITLE }
  }, [title])
}

/*
 * The mark on the tab.
 *
 * Two things went wrong with simply setting the href. A page that wants no
 * mark of its own never said so, so the Create mark stayed on after you left
 * Create; and a browser that has already drawn an icon often ignores a change
 * to the same element, so nothing redrew even when the address was right.
 *
 * So the wanted mark is kept here instead, as a pile: whoever asked last and
 * is still on screen wins, and when they leave the one under them comes back.
 * Every change draws a new element, which is the part browsers do listen to.
 */
const wanted: { token: number; url: string }[] = []
let tokens = 0
let showing = ''

function drawIcon() {
  const url = wanted.length ? wanted[wanted.length - 1].url : DEFAULT_ICON
  if (url === showing) return
  showing = url

  for (const old of Array.from(document.head.querySelectorAll('link[rel="icon"]'))) {
    old.remove()
  }
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = url.endsWith('.svg') ? 'image/svg+xml' : 'image/png'
  link.href = url
  document.head.appendChild(link)
}

/**
 * Wear a mark while this page is on screen: Create's own on every page of
 * Create, a Space's emblem inside that World, and Kobblon's everywhere
 * else. Passing nothing means the plain Kobblon mark.
 */
export function useFavicon(url?: string | null) {
  useEffect(() => {
    const mine = { token: (tokens += 1), url: url || DEFAULT_ICON }
    wanted.push(mine)
    drawIcon()
    return () => {
      const at = wanted.findIndex((one) => one.token === mine.token)
      if (at >= 0) wanted.splice(at, 1)
      drawIcon()
    }
  }, [url])
}

/** Pages with no mark of their own still put ours back on the way in. */
export function useSiteFavicon() {
  useFavicon(DEFAULT_ICON)
}

/**
 * The card this page would show if it were pasted somewhere else. The robots
 * that build those cards do not run scripts, so this is not what they read:
 * the build writes a file for every fixed address, and the og edge function
 * answers for the ones that depend on what they point at. This keeps the
 * document itself honest, which is what a browser, a saved link and anything
 * that does run scripts will go by.
 */
export function useSocialCard(card: {
  title?: string | null
  description?: string | null
  image?: string | null
}) {
  const { title, description, image } = card

  useEffect(() => {
    const set = (selector: string, attribute: 'content' | 'href', value: string) => {
      const node = document.head.querySelector<HTMLMetaElement>(selector)
      if (!node) return undefined
      const previous = node.getAttribute(attribute) ?? ''
      node.setAttribute(attribute, value)
      return () => node.setAttribute(attribute, previous)
    }

    const undo = [
      title && set('meta[property="og:title"]', 'content', title),
      title && set('meta[name="twitter:title"]', 'content', title),
      description && set('meta[name="description"]', 'content', description),
      description && set('meta[property="og:description"]', 'content', description),
      description && set('meta[name="twitter:description"]', 'content', description),
      image && set('meta[property="og:image"]', 'content', image),
      image && set('meta[name="twitter:image"]', 'content', image),
      set('meta[property="og:url"]', 'content', window.location.href),
      set('link[rel="canonical"]', 'href', window.location.href),
    ]

    return () => undo.forEach((step) => typeof step === 'function' && step())
  }, [title, description, image])
}
