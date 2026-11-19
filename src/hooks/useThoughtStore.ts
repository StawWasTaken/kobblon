import { useEffect, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { getThoughts } from '@/lib/api'
import type { Thought } from '@/types/db'

/*
 * What people are thinking, kept in one place for the whole tab.
 *
 * The same reasoning as presence: a thought fetched by a page is a
 * photograph of the moment that page asked. Somebody could change theirs
 * and still be saying yesterday's thing in your friends list until you
 * reloaded - which is exactly what a status must not do.
 *
 * So a screen says which people it is drawing, this asks once for the lot,
 * and everybody who writes one is heard: `thoughts` is in the realtime
 * publication, so a change lands here and every bubble and line drawing
 * that person redraws itself.
 *
 * A thought you may not read never arrives - that is the table's own
 * policy, not this file's - so "nothing here" and "not allowed" are the
 * same answer, which is the right answer to draw either way.
 */
const thoughts = new Map<string, Thought | null>()

let version = 0
const watching = new Set<() => void>()

function changed() {
  version += 1
  watching.forEach((tell) => tell())
}

function useVersion() {
  return useSyncExternalStore(
    (tell) => {
      watching.add(tell)
      return () => { watching.delete(tell) }
    },
    () => version,
    () => version,
  )
}

/** What a screen learned about a batch of people. */
function learn(ids: string[], found: Record<string, Thought>) {
  for (const id of ids) thoughts.set(id, found[id] ?? null)
  changed()
}

/** One person's, for anything already inside a list that asked. */
export function thoughtOf(id?: string | null): Thought | null {
  return id ? thoughts.get(id) ?? null : null
}

/**
 * Ask for the people a screen is drawing.
 *
 * The key is the sorted ids, so a list that re-renders with the same people
 * asks once rather than once per render.
 */
export function useThoughts(people: Array<{ id?: string | null } | null | undefined>) {
  const key = people
    .map((one) => one?.id)
    .filter((id): id is string => !!id)
    .sort()
    .join(',')

  useEffect(() => {
    const ids = key ? key.split(',') : []
    if (!ids.length) return

    let wanted = true
    void getThoughts(ids)
      .then((found) => { if (wanted) learn(ids, found) })
      .catch(() => {})

    return () => { wanted = false }
  }, [key])
}

/** One person's, kept live. Reading only: a list has to have asked. */
export function useThought(id?: string | null): Thought | null {
  useVersion()
  return thoughtOf(id)
}

/**
 * Heard from the database rather than asked for.
 *
 * One channel for the tab, started by the shell. A row somebody is not
 * allowed to read is not sent to them, so this hears about friends and
 * about anybody who set theirs to everyone, which is the same set the
 * screen could have fetched.
 */
export function useThoughtsLive() {
  useEffect(() => {
    const channel = supabase
      .channel('thoughts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'thoughts' },
        (message) => {
          const row = (message.new ?? message.old) as Partial<Thought> | undefined
          const id = row?.user_id
          if (!id) return
          if (message.eventType === 'DELETE') thoughts.set(id, null)
          else thoughts.set(id, message.new as Thought)
          changed()
        },
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])
}

/** Your own, after you have written or taken one down. */
export function rememberThought(id: string, next: Thought | null) {
  thoughts.set(id, next)
  changed()
}
