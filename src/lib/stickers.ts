/*
 * Stickers, and the custom emoji that share their road.
 *
 * A sticker travels as a name. `:plunk-smug:` is in the message; the
 * picture is looked up by whoever draws it. The applications' round 57
 * asked for this decision and it is the only form that survives the three
 * places Staw wants stickers in - the World chat, the friends chat and a
 * community wall - because the Launcher resolves its own pictures through
 * `app://kobblon/...` and the website resolves the same picture from an
 * ordinary path. One picture already has two true addresses, so an address
 * in a message is an address that was only true where it was typed.
 *
 * The list is `public.pictures_by_name`, read once per tab. Nothing here
 * hard-codes a path or a name: the day Staw draws a tenth Plunk it is one
 * row and no build.
 *
 * Two kinds, one namespace, because a name must mean exactly one thing:
 * `alone` is a sticker, drawn large and only when it is the whole message,
 * and `inline` is a custom emoji, drawn inside a sentence. The row says
 * which, so neither side decides it twice.
 */

import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { asset } from './asset'

export type NamedPicture = {
  name: string
  pack: string
  label: string
  /** The 512px source, from the site root. What a message is drawn from. */
  picture: string
  /** ~256px WebP, for a picker that opens two dozen at once. */
  small: string | null
  draws: 'alone' | 'inline'
  sort: number
}

/** A path from the table, against wherever this bundle is served from. */
export const pictureUrl = (path: string) => asset(path)

/* ------------------------------------------------------------- the list */

/*
 * Held for the tab, and the listeners exist for one reason: the drawing is
 * synchronous and the list is not. A message drawn before the list arrives
 * would show the characters `:plunk-smug:` and then become a picture, so
 * whatever is on screen is told when the answer lands.
 */
let held: NamedPicture[] | null = null
let asking: Promise<NamedPicture[]> | null = null
const waiting = new Set<(rows: NamedPicture[]) => void>()

export const namedHeld = () => held

export function loadNamedPictures(): Promise<NamedPicture[]> {
  if (held) return Promise.resolve(held)
  if (asking) return asking
  asking = (async () => {
    const { data } = await supabase
      .from('pictures_by_name')
      .select('name, pack, label, picture, small, draws, sort')
      .order('pack')
      .order('sort')
    held = (data as NamedPicture[] | null) ?? []
    for (const tell of waiting) tell(held)
    return held
  })()
  return asking
}

/** What is in hand, asking for it the first time anything wants it. */
export function useNamedPictures(): NamedPicture[] | null {
  const [rows, setRows] = useState<NamedPicture[] | null>(held)

  useEffect(() => {
    if (held) { setRows(held); return }
    waiting.add(setRows)
    void loadNamedPictures()
    return () => { waiting.delete(setRows) }
  }, [])

  return rows
}

/* ------------------------------------------------------------ in a message */

const TOKEN = /^:([a-z0-9]+(?:-[a-z0-9]+)*):$/

/**
 * The sticker, if this message is one token and nothing else.
 *
 * The same rule `gifIn` already carries, and for the same reason: a token
 * with words around it is a sentence somebody wrote, and drawing it as a
 * picture would hide what they actually said. Their round 57 asked whether
 * a sticker may sit in a sentence - no, and the World chat has to agree or
 * one message reads two ways in two places.
 *
 * A name that is not in the list stays the characters somebody typed. That
 * is deliberate too: a retired sticker is still drawn where it was sent,
 * and a name that never existed is not a broken picture.
 */
export function stickerIn(text: string, list: NamedPicture[] | null): NamedPicture | null {
  if (!list?.length) return null
  const hit = TOKEN.exec(text.trim())
  if (!hit) return null
  const found = list.find((one) => one.name === hit[1])
  return found && found.draws === 'alone' ? found : null
}

/** The ones a picker offers, which is the sets in the order they were drawn. */
export function stickersToOffer(list: NamedPicture[] | null): NamedPicture[] {
  return (list ?? []).filter((one) => one.draws === 'alone')
}

/** What goes in the box to send one. */
export const tokenFor = (one: NamedPicture) => `:${one.name}:`
