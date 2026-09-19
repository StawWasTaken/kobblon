/**
 * Every link carries the number of the thing it points at, with the name
 * after it for people to read: /u/1042/stawrer. Names change, numbers do not,
 * so an old link still lands in the right place.
 *
 * Where the number has not been loaded, the name-only form is used instead.
 * Those addresses still work and send you on to the numbered one.
 */
import { slugify } from './format'

const slugPart = (value: string) => encodeURIComponent(value)

export function profileLink(person: { username: string; content_id?: number | null }) {
  return person.content_id
    ? `/u/${person.content_id}/${slugPart(person.username)}`
    : `/u/${slugPart(person.username)}`
}

export function spaceLink(space: {
  slug: string
  content_id?: number | null
  owner?: { username: string } | null
}) {
  if (space.content_id) return `/s/${space.content_id}/${slugPart(space.slug)}`
  return space.owner ? `/u/${slugPart(space.owner.username)}/${slugPart(space.slug)}` : '/discover'
}

export function communityLink(community: { slug: string; content_id?: number | null }) {
  return community.content_id
    ? `/c/${community.content_id}/${slugPart(community.slug)}`
    : `/c/${slugPart(community.slug)}`
}

/**
 * An event's address. Its title is written into the link as a slug rather
 * than as the title itself, so a renamed event gets a tidy address and the
 * number keeps the old link working.
 */
export function eventLink(event: { content_id: number | null; title: string }) {
  if (!event.content_id) return '#'
  return `/e/${event.content_id}/${slugPart(slugify(event.title).slice(0, 40) || 'event')}`
}

/**
 * A World: /worlds/1042/first-ground.
 *
 * Not /e/, which community events had first. Two kinds of content at one
 * prefix is a bug that only shows up once both exist.
 */
export const worldLink = (one: { content_id: number; slug?: string | null; name: string }) =>
  `/worlds/${one.content_id}/${one.slug || slugify(one.name)}`
