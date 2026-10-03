/*
 * The mannequin: one body, everywhere a thing is shown worn.
 *
 * There were five of these - the card drawing had one, the item page
 * another, the create dialog a third, and the bare pages two more - all
 * written by hand and none of them the same. So a shirt's card, that shirt
 * on its own page and that shirt while it was being made were three
 * different people, which makes "does this look right" a question nobody can
 * answer by comparing two screens.
 *
 * Staw's rule: the same rig every time. Grey from head to foot, so the thing
 * being shown is the only coloured object in the frame, and wearing the free
 * face, because a blank head does not read as a person.
 *
 * Grey everywhere is deliberately the one body a person is not allowed to
 * have - `set_body_colours` refuses it without trousers. A mannequin is not
 * a person; it is the absence of one, and looking slightly unlike anybody is
 * the point.
 */
import { plainFace } from './plainFace'

/** The one body. Six parts, one grey. */
export const MANNEQUIN_BODY: Record<string, string> = {
  Head: '#b9bfcc', Torso: '#b9bfcc', LeftArm: '#b9bfcc',
  RightArm: '#b9bfcc', LeftLeg: '#b9bfcc', RightLeg: '#b9bfcc',
}

/**
 * Which face it wears: FACE-1119, the free one everybody starts with.
 *
 * The number lives here; fetching it lives in `@/lib/api`, which is the one
 * place allowed to talk to the database. The other way round made a cycle -
 * this file would import `api`, `api` imports `portrait`, and `portrait`
 * imports this - and a cycle is how a value gets read before the module that
 * decides it has finished, which this project has met three times.
 */
export const FLOOR_FACE = 1119

/**
 * The mannequin wearing something, ready for `AvatarStage` or `drawPortrait`.
 *
 * `face` is passed in rather than awaited here so this stays synchronous:
 * every caller already has a render to do, and a body that appears a frame
 * after the thing on it is worse than a body whose face arrives late.
 */
export function mannequinWearing<T>(pieces: T[], face?: string | null) {
  return {
    body: MANNEQUIN_BODY,
    pieces: [
      { slot: 'face', kind: 'face', imageUrl: face ?? plainFace() },
      ...pieces,
    ],
  }
}
