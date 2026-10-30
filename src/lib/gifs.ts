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

const KLIPY = /^https:\/\/(?:[a-z0-9-]+\.)*klipy\.com\/[^\s]+$/i

/** The address, if this message is one Klipy picture and nothing else. */
export function gifIn(text: string): string | null {
  const one = text.trim()
  return KLIPY.test(one) ? one : null
}
