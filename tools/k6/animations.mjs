/*
 * K6's first animations.
 *
 * These belong to the engine, not to an experience: every Kobblon experience
 * gets idle, walk, run, jump, fall, land and a wave without shipping its own,
 * and an experience that wants something else adds to this rather than
 * replacing it.
 *
 * Each track is a bone's rotation over time, written as quaternions. The
 * poses are keyed by hand, because seven short clips of a blocky avatar do
 * not need a motion pipeline.
 */

/** A quaternion from an axis-angle turn, in degrees because that is readable. */
function turn(axis, degrees) {
  const half = (degrees * Math.PI) / 360
  const s = Math.sin(half)
  const [x, y, z] = axis
  return [x * s, y * s, z * s, Math.cos(half)]
}

const X = [1, 0, 0]
const Z = [0, 0, 1]
const still = [0, 0, 0, 1]

/** Builds one bone's track from a list of [time, quaternion] pairs. */
const track = (joint, keys) => ({
  joint,
  times: keys.map(([time]) => time),
  values: keys.map(([, value]) => value),
})

export function animations({ index }) {
  const arms = { L: index.J_ShoulderL, R: index.J_ShoulderR }
  const elbows = { L: index.J_ElbowL, R: index.J_ElbowR }
  const hips = { L: index.J_HipL, R: index.J_HipR }
  const knees = { L: index.J_KneeL, R: index.J_KneeR }

  /** A limb swing, opposite on each side, as a walk or a run needs. */
  const stride = (joint, axis, amount, length, phase = 0) => track(joint, [
    [0, turn(axis, phase ? -amount : amount)],
    [length / 2, turn(axis, phase ? amount : -amount)],
    [length, turn(axis, phase ? -amount : amount)],
  ])

  return [
    {
      // Breathing, barely. A still avatar reads as a broken avatar.
      name: 'idle',
      tracks: [
        track(index.J_Spine, [[0, turn(X, 0)], [1.4, turn(X, 1.6)], [2.8, turn(X, 0)]]),
        track(index.J_Head, [[0, turn(X, 0)], [1.4, turn(X, -1.4)], [2.8, turn(X, 0)]]),
        /*
         * Fore and aft, opposite on each side, the way arms hang on
         * somebody standing.
         *
         * They used to breathe on Z, which is the shoulder hinging out
         * away from the ribs — so a still avatar held its arms a few
         * degrees off the torso and swung them further out. Staw: "i dont
         * like how the arms are animated towards the torso, i would like
         * them to be animated towards the behind and the infront". Every
         * other clip already swings on X; idle was the only one that did
         * not. `wave` stays on Z and is right: an arm waves out, not
         * forward.
         */
        track(arms.L, [[0, turn(X, -3)], [1.4, turn(X, 3)], [2.8, turn(X, -3)]]),
        track(arms.R, [[0, turn(X, 3)], [1.4, turn(X, -3)], [2.8, turn(X, 3)]]),
      ],
    },
    {
      name: 'walk',
      tracks: [
        stride(hips.L, X, 24, 1.0),
        stride(hips.R, X, 24, 1.0, 1),
        track(knees.L, [[0, turn(X, -6)], [0.25, turn(X, -26)], [0.5, turn(X, -4)], [0.75, turn(X, -10)], [1.0, turn(X, -6)]]),
        track(knees.R, [[0, turn(X, -4)], [0.25, turn(X, -10)], [0.5, turn(X, -6)], [0.75, turn(X, -26)], [1.0, turn(X, -4)]]),
        stride(arms.L, X, 20, 1.0, 1),
        stride(arms.R, X, 20, 1.0),
        track(index.J_Spine, [[0, turn(X, 2)], [0.5, turn(X, 3)], [1.0, turn(X, 2)]]),
      ],
    },
    {
      name: 'run',
      tracks: [
        stride(hips.L, X, 42, 0.62),
        stride(hips.R, X, 42, 0.62, 1),
        track(knees.L, [[0, turn(X, -14)], [0.155, turn(X, -62)], [0.31, turn(X, -8)], [0.465, turn(X, -26)], [0.62, turn(X, -14)]]),
        track(knees.R, [[0, turn(X, -8)], [0.155, turn(X, -26)], [0.31, turn(X, -14)], [0.465, turn(X, -62)], [0.62, turn(X, -8)]]),
        stride(arms.L, X, 46, 0.62, 1),
        stride(arms.R, X, 46, 0.62),
        track(elbows.L, [[0, turn(X, -52)], [0.62, turn(X, -52)]]),
        track(elbows.R, [[0, turn(X, -52)], [0.62, turn(X, -52)]]),
        track(index.J_Spine, [[0, turn(X, 8)], [0.62, turn(X, 8)]]),
      ],
    },
    {
      // The push off. Held at the end, because the fall takes over from here.
      name: 'jump',
      tracks: [
        track(hips.L, [[0, turn(X, 26)], [0.18, turn(X, -12)], [0.36, turn(X, -6)]]),
        track(hips.R, [[0, turn(X, 26)], [0.18, turn(X, -12)], [0.36, turn(X, -6)]]),
        track(knees.L, [[0, turn(X, -52)], [0.18, turn(X, -8)], [0.36, turn(X, -4)]]),
        track(knees.R, [[0, turn(X, -52)], [0.18, turn(X, -8)], [0.36, turn(X, -4)]]),
        track(arms.L, [[0, turn(X, 30)], [0.18, turn(X, -120)], [0.36, turn(X, -96)]]),
        track(arms.R, [[0, turn(X, 30)], [0.18, turn(X, -120)], [0.36, turn(X, -96)]]),
        track(index.J_Spine, [[0, turn(X, 14)], [0.18, turn(X, -4)], [0.36, turn(X, -2)]]),
      ],
    },
    {
      name: 'fall',
      tracks: [
        track(hips.L, [[0, turn(X, -14)], [0.6, turn(X, -8)], [1.2, turn(X, -14)]]),
        track(hips.R, [[0, turn(X, 10)], [0.6, turn(X, 16)], [1.2, turn(X, 10)]]),
        track(knees.L, [[0, turn(X, -24)], [1.2, turn(X, -24)]]),
        track(knees.R, [[0, turn(X, -12)], [1.2, turn(X, -12)]]),
        track(arms.L, [[0, turn(X, -104)], [0.6, turn(X, -118)], [1.2, turn(X, -104)]]),
        track(arms.R, [[0, turn(X, -104)], [0.6, turn(X, -118)], [1.2, turn(X, -104)]]),
      ],
    },
    {
      // The knees taking the weight, over almost as soon as it starts.
      name: 'land',
      tracks: [
        track(hips.L, [[0, turn(X, 16)], [0.12, turn(X, 30)], [0.34, still]]),
        track(hips.R, [[0, turn(X, 16)], [0.12, turn(X, 30)], [0.34, still]]),
        track(knees.L, [[0, turn(X, -30)], [0.12, turn(X, -58)], [0.34, still]]),
        track(knees.R, [[0, turn(X, -30)], [0.12, turn(X, -58)], [0.34, still]]),
        // Landing settles into idle's rest, so this ends where idle
        // begins. It used to end on the old splay, which put the arms
        // back out to the sides every time somebody touched the ground.
        track(arms.L, [[0, turn(X, -40)], [0.12, turn(X, -16)], [0.34, turn(X, -3)]]),
        track(arms.R, [[0, turn(X, -40)], [0.12, turn(X, -16)], [0.34, turn(X, 3)]]),
        track(index.J_Spine, [[0, turn(X, 10)], [0.12, turn(X, 16)], [0.34, still]]),
      ],
    },
    {
      name: 'wave',
      tracks: [
        // Outward, away from the head: the arm hinges on Z, and on the right
        // side that is the negative direction.
        track(arms.R, [[0, turn(Z, 4)], [0.3, turn(Z, -116)], [1.5, turn(Z, -116)], [1.8, turn(Z, 4)]]),
        track(elbows.R, [
          [0.3, turn(Z, -8)], [0.6, turn(Z, -30)], [0.9, turn(Z, -8)],
          [1.2, turn(Z, -30)], [1.5, turn(Z, -8)],
        ]),
        track(index.J_Head, [[0, still], [0.5, turn([0, 1, 0], -10)], [1.4, turn([0, 1, 0], -10)], [1.8, still]]),
      ],
    },
  ]
}
