import {
  faImage, faMusic, faVideo, faFont, faCube, faShapes,
} from '@fortawesome/free-solid-svg-icons'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import type { AssetKind } from '@/types/db'

/*
 * What each kind of content is called, everywhere.
 *
 * One file, because Kobblon Workspace and the Create pages must not disagree
 * about this. A kind called "Model" in one window and "Mesh" in the other is
 * two products; and the version of that which actually bites is subtler — a
 * list of accepted extensions copied into the Workspace, then a format added
 * here and not there, so a file Kobblon accepts is refused by Kobblon.
 *
 * So the words, the icons, the codes and the accepted extensions live here
 * and nowhere else. The Workspace imports this module rather than a
 * component, because a name is not a component.
 */

export const kindIcons: Record<AssetKind, IconDefinition> = {
  image: faImage,
  audio: faMusic,
  video: faVideo,
  font: faFont,
  build: faShapes,
  mesh: faCube,
}

export const kindLabels: Record<AssetKind, string> = {
  image: 'Decal',
  audio: 'Audio',
  video: 'Video',
  font: 'Font',
  build: 'Build',
  mesh: 'Mesh',
}

/** The letters in front of the number every piece of content carries. */
export const kindCodes: Record<AssetKind, string> = {
  image: 'IMG', audio: 'SND', video: 'VID', font: 'FNT', build: 'BLD', mesh: 'MSH',
}

/** The number every piece of content carries, with its kind in front. */
export const contentTag = (kind: AssetKind, id: number | null) =>
  id ? `${kindCodes[kind]}-${id}` : ''

/**
 * What a file picker offers for each kind.
 *
 * Kobblon's own part file is `.kbfl`, which is JSON under a name no browser
 * has a type for, so the extension has to be offered explicitly or the
 * picker greys it out.
 */
export const kindAccepts: Record<AssetKind, string> = {
  image: 'image/png,image/jpeg,image/gif,image/webp,image/avif',
  audio: 'audio/mpeg,audio/ogg,application/ogg,audio/wav,audio/aac,audio/flac,.mp3,.ogg,.wav,.flac,.aac',
  video: 'video/mp4,video/webm,video/ogg,.mp4,.webm',
  font: 'font/woff2,font/woff,font/ttf,font/otf,.woff2,.woff,.ttf,.otf',
  // `.obj` is plain text and no browser has a type for it, so the
  // extension has to be offered explicitly the same way `.kbfl` is.
  mesh: 'model/gltf-binary,model/gltf+json,.glb,.gltf,.obj',
  build: '.kbfl,application/json',
}

/**
 * Kinds that are made rather than uploaded.
 *
 * A Build is an arrangement of parts, and the thing that arranges parts is
 * the Workspace, which publishes it from there. A file picker for one would
 * be a file picker for a file nothing can make.
 */
export const madeElsewhere: AssetKind[] = ['build']

/** The kinds somebody can actually choose in an upload dialog. */
export const uploadableKinds = (Object.keys(kindLabels) as AssetKind[])
  .filter((one) => !madeElsewhere.includes(one))
