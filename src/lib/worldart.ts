import { asset } from '@/lib/asset'

/**
 * What a World looks like before anybody has given it a picture.
 *
 * Staw drew both: a square emblem and a 16/9 thumbnail, the mark sunk into
 * its own dark, almost out of sight. Not the torn square - `Missing` is for
 * a picture that was meant to be there and is not, and a World nobody has
 * decorated yet is not broken, it just has not been decorated. One says
 * "this failed", the other says "this is a World".
 *
 * They are two files rather than one because the shapes differ: a square
 * emblem stretched across a 16/9 slot puts the mark off the middle, and a
 * wide one squeezed into a tile does the same the other way.
 */
export const DEFAULT_WORLD_EMBLEM = asset('/brand/world-emblem.png')
export const DEFAULT_WORLD_THUMBNAIL = asset('/brand/world-thumbnail.png')

type Art = { emblem_url?: string | null; cover_url?: string | null }

/** The square one: a tile, a shelf, the badge over a cover. */
export function worldEmblem(world: Art) {
  return world.emblem_url ?? world.cover_url ?? DEFAULT_WORLD_EMBLEM
}

/** The wide one: a card, a feature, the top of a World's own page. */
export function worldThumbnail(world: Art) {
  return world.cover_url ?? world.emblem_url ?? DEFAULT_WORLD_THUMBNAIL
}
