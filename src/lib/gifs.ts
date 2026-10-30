/*
 * A message that is nothing but a picture.
 *
 * The applications' GIF card sends a GIF as its address, because the chat
 * transport carries text and a transport that learns a new kind of message
 * every time the interface grows one breaks every time. So a GIF arriving
 * here is a line of chat whose whole content is a Klipy address, and both
 * sides turn it back into a picture.
 *
 * `klipy.com` is on `allowed_link_hosts` as of 0307, so one of these is no
 * longer masked on its way through `screen_say`.
 *
 * Only the whole message counts. An address with words around it is a
 * message with a link in it, and drawing that as a picture would hide what
 * somebody actually wrote.
 */

import { supabase } from './supabase'

const KLIPY = /^https:\/\/(?:[a-z0-9-]+\.)*klipy\.(?:com|co)\/[^\s]+$/i

/** The address, if this message is one Klipy picture and nothing else. */
export function gifIn(text: string): string | null {
  const one = text.trim()
  return KLIPY.test(one) ? one : null
}

/* ------------------------------------------------------------ finding one */

export type Gif = { id: string; url: string; width: number; height: number }

/*
 * Whether this website can fetch GIFs at all, asked once per tab.
 *
 * Klipy wants a key, the key lives in the `gifs` function's environment,
 * and until somebody sets it the function says so rather than returning an
 * empty list. The card's button is drawn only when the answer is yes -
 * `docs/neoclassic.md`: a control that implies something the runtime does
 * not do is worse than no control.
 */
let able: Promise<boolean> | null = null

export function gifsReady(): Promise<boolean> {
  if (!able) {
    able = searchGifs('')
      .then((rows) => Array.isArray(rows))
      .catch(() => false)
  }
  return able
}

/** GIFs for a word, or what is going around when there is no word. */
export async function searchGifs(term: string, page = 1): Promise<Gif[]> {
  const { data, error } = await supabase.functions.invoke('gifs', {
    body: { q: term, page },
  })
  if (error) throw error
  if (!data || !Array.isArray((data as { items?: unknown }).items)) {
    throw new Error('no GIFs')
  }
  return (data as { items: Gif[] }).items
}
