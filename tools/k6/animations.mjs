/*
 * K6's animations.
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
const Y = [0, 1, 0]
const Z = [0, 0, 1]
const still = [0, 0, 0, 1]

/** Builds one bone's track from a list of [time, quaternion] pairs. */
const track = (joint, keys) => ({
  joint,
  times: keys.map(([time]) => time),
  values: keys.map(([, value]) => value),
})

/**
 * The same, for a bone moving rather than turning: [time, [x, y, z]] pairs,
 * as an offset from where the bone rests. The builder adds the rest back.
 *
 * Only the dances use this, and only on the hips, because a dance that does
 * not leave the ground is a person standing still waving their arms. Walking
 * and running stay rotation-only: the engine moves the body for those.
 *
 * Every bob here goes *up* from rest and comes back to it, never below. The
 * hips carry the legs, and there is no IK holding the feet down, so a
 * downward bob does not crouch - it posts the feet through the floor, which
 * is exactly how the first pass of these looked. Up reads as a hop and the
 * low point of the cycle is the body standing where it belongs.
 */
const shift = (joint, keys) => ({
  joint,
  path: 'translation',
  times: keys.map(([time]) => time),
  values: keys.map(([, value]) => value),
})

export function animations({ index }) {
  const arms = { L: index.J_ShoulderL, R: index.J_ShoulderR }
  const hipsBone = index.J_Hips
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
         * away from the ribs - so a still avatar held its arms a few
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
      /*
       * Redrawn, round 286. The first one hinged the arm out to about
       * shoulder height and flapped the forearm there, which reads as
       * somebody checking their watch rather than waving: a wave is a
       * raised hand, and the raising is the part that carries across a
       * World.
       *
       * Outward, away from the head: the arm hinges on Z, and on the right
       * side that is the negative direction. 150 puts the upper arm past
       * vertical, so the forearm stands up over the shoulder.
       */
      name: 'wave',
      tracks: [
        track(arms.R, [
          [0, turn(Z, 4)], [0.28, turn(Z, -116)],
          [1.55, turn(Z, -114)], [1.9, turn(Z, 4)],
        ]),
        /*
         * The hand swinging, not the whole arm shaking: four passes, and it
         * starts and ends straight so the arm comes down in one piece.
         *
         * Both numbers here are smaller than they want to be, and the
         * shoulder is the reason every raise in this file stops around 116.
         * The shoulder joint sits inside the arm rather than at its top, so
         * past about 120 degrees the cap at the top of the limb swings down
         * and away from the body and the arm reads as detached - 152 looked
         * like a forearm floating next to somebody's ear. The flap was also
         * 56 degrees wide and put the hand through the head coming back.
         */
        track(elbows.R, [
          [0.28, turn(Z, 0)],
          [0.5, turn(Z, -28)], [0.72, turn(Z, 8)],
          [0.94, turn(Z, -28)], [1.16, turn(Z, 8)],
          [1.38, turn(Z, -24)], [1.55, turn(Z, 0)],
        ]),
        // Leaning very slightly onto the other foot, which is what a person
        // does when one arm goes up, and the head turning to whoever it is for.
        track(index.J_Spine, [[0, still], [0.3, turn(Z, 5)], [1.55, turn(Z, 5)], [1.9, still]]),
        track(index.J_Head, [[0, still], [0.45, turn(Y, -12)], [1.45, turn(Y, -12)], [1.9, still]]),
        // The idle arm stops breathing for the duration rather than drifting
        // against the wave.
        track(arms.L, [[0, turn(X, -3)], [0.3, turn(X, -8)], [1.6, turn(X, -8)], [1.9, turn(X, -3)]]),
      ],
    },
    /*
     * ---------------------------------------------------------- the dances
     *
     * Four looping clips, keyed by hand like everything above. They are
     * authored as one cycle that meets itself at both ends, because looping
     * belongs to the caller - `emote(name, { loop })` - and a clip that
     * repeats internally fights that. None of them has a return-to-idle
     * tail: an emote is dropped the moment somebody walks or jumps, so the
     * tail would be cut off more often than it played.
     *
     * The hips carry a bob on all four. Rotation alone cannot lift a body,
     * and a dance that never leaves the ground is arm-waving.
     */
    {
      /*
       * Kobblon's own. A two-beat bounce with the arms pumping out of phase
       * and the hips swinging under it - the thing a blocky avatar is best
       * at, which is weight going down and coming back up.
       */
      name: 'kobdance',
      tracks: [
        shift(hipsBone, [
          [0, [0, 0, 0]], [0.2, [0, 0.4, 0]], [0.4, [0, 0, 0]],
          [0.6, [0, 0.4, 0]], [0.8, [0, 0, 0]],
          [1.0, [0, 0.4, 0]], [1.2, [0, 0, 0]],
          [1.4, [0, 0.4, 0]], [1.6, [0, 0, 0]],
        ]),
        track(hipsBone, [[0, turn(Y, 12)], [0.4, turn(Y, -12)], [0.8, turn(Y, 12)], [1.2, turn(Y, -12)], [1.6, turn(Y, 12)]]),
        track(index.J_Chest, [[0, turn(Y, -8)], [0.4, turn(Y, 8)], [0.8, turn(Y, -8)], [1.2, turn(Y, 8)], [1.6, turn(Y, -8)]]),
        track(index.J_Spine, [[0, turn(X, 5)], [0.2, turn(X, 10)], [0.6, turn(X, 10)], [1.0, turn(X, 10)], [1.6, turn(X, 5)]]),
        // Out to the sides and pumping up, opposite sides on opposite beats.
        track(arms.L, [[0, turn(Z, 72)], [0.4, turn(Z, 116)], [0.8, turn(Z, 72)], [1.2, turn(Z, 116)], [1.6, turn(Z, 72)]]),
        track(arms.R, [[0, turn(Z, -116)], [0.4, turn(Z, -72)], [0.8, turn(Z, -116)], [1.2, turn(Z, -72)], [1.6, turn(Z, -116)]]),
        track(elbows.L, [[0, turn(Z, 42)], [0.4, turn(Z, 10)], [0.8, turn(Z, 42)], [1.2, turn(Z, 10)], [1.6, turn(Z, 42)]]),
        track(elbows.R, [[0, turn(Z, -10)], [0.4, turn(Z, -42)], [0.8, turn(Z, -10)], [1.2, turn(Z, -42)], [1.6, turn(Z, -10)]]),
        // Knees taking the bounce. Without these the body sinks and the legs
        // go with it, which looks like falling through the floor.
        // Bent on the ground and straight in the air, which is the half of a
        // bounce the eye actually reads.
        track(knees.L, [[0, turn(X, -32)], [0.2, turn(X, -6)], [0.4, turn(X, -32)], [0.6, turn(X, -6)], [0.8, turn(X, -32)], [1.0, turn(X, -6)], [1.2, turn(X, -32)], [1.4, turn(X, -6)], [1.6, turn(X, -32)]]),
        track(knees.R, [[0, turn(X, -32)], [0.2, turn(X, -6)], [0.4, turn(X, -32)], [0.6, turn(X, -6)], [0.8, turn(X, -32)], [1.0, turn(X, -6)], [1.2, turn(X, -32)], [1.4, turn(X, -6)], [1.6, turn(X, -32)]]),
        track(hips.L, [[0, turn(X, 18)], [0.2, turn(X, 4)], [0.4, turn(X, 18)], [0.8, turn(X, 18)], [1.2, turn(X, 18)], [1.6, turn(X, 18)]]),
        track(hips.R, [[0, turn(X, 18)], [0.2, turn(X, 4)], [0.4, turn(X, 18)], [0.8, turn(X, 18)], [1.2, turn(X, 18)], [1.6, turn(X, 18)]]),
        track(index.J_Head, [[0, turn(X, 0)], [0.2, turn(X, 9)], [0.4, turn(X, 0)], [0.6, turn(X, 9)], [0.8, turn(X, 0)], [1.0, turn(X, 9)], [1.2, turn(X, 0)], [1.4, turn(X, 9)], [1.6, turn(X, 0)]]),
      ],
    },
    {
      /*
       * A step side to side, arms swinging together across the body. The
       * slowest of the four and the one that reads as somebody enjoying
       * themselves rather than performing.
       */
      name: 'dance1',
      tracks: [
        shift(hipsBone, [
          [0, [-0.2, 0, 0]], [0.45, [0, 0.24, 0]], [0.9, [0.2, 0, 0]],
          [1.35, [0, 0.24, 0]], [1.8, [-0.2, 0, 0]],
        ]),
        track(hipsBone, [[0, turn(Y, -16)], [0.9, turn(Y, 16)], [1.8, turn(Y, -16)]]),
        track(index.J_Chest, [[0, turn(Z, 7)], [0.9, turn(Z, -7)], [1.8, turn(Z, 7)]]),
        // Both arms the same way at once: the sway is the whole upper body
        // going over, not two arms doing their own thing.
        track(arms.L, [[0, turn(Z, 96)], [0.45, turn(Z, 54)], [0.9, turn(Z, 30)], [1.35, turn(Z, 54)], [1.8, turn(Z, 96)]]),
        track(arms.R, [[0, turn(Z, -30)], [0.45, turn(Z, -54)], [0.9, turn(Z, -96)], [1.35, turn(Z, -54)], [1.8, turn(Z, -30)]]),
        track(elbows.L, [[0, turn(X, -46)], [0.9, turn(X, -70)], [1.8, turn(X, -46)]]),
        track(elbows.R, [[0, turn(X, -70)], [0.9, turn(X, -46)], [1.8, turn(X, -70)]]),
        // The weight going onto one leg and then the other.
        track(hips.L, [[0, turn(Z, 10)], [0.9, turn(Z, -4)], [1.8, turn(Z, 10)]]),
        track(hips.R, [[0, turn(Z, 4)], [0.9, turn(Z, -10)], [1.8, turn(Z, 4)]]),
        track(knees.L, [[0, turn(X, -24)], [0.45, turn(X, -6)], [0.9, turn(X, -24)], [1.35, turn(X, -6)], [1.8, turn(X, -24)]]),
        track(knees.R, [[0, turn(X, -24)], [0.45, turn(X, -6)], [0.9, turn(X, -24)], [1.35, turn(X, -6)], [1.8, turn(X, -24)]]),
        track(index.J_Head, [[0, turn(Y, -10)], [0.9, turn(Y, 10)], [1.8, turn(Y, -10)]]),
      ],
    },
    {
      /*
       * One arm up and pointing, the other on the hip, everything punching
       * on the beat. The snappy one - 1.2 seconds a cycle, so the keys sit
       * closer together than anywhere else in this file.
       */
      name: 'dance2',
      tracks: [
        shift(hipsBone, [
          [0, [0, 0, 0]], [0.15, [0, 0.28, 0]], [0.3, [0, 0, 0]],
          [0.45, [0, 0.28, 0]], [0.6, [0, 0, 0]],
          [0.75, [0, 0.28, 0]], [0.9, [0, 0, 0]],
          [1.05, [0, 0.28, 0]], [1.2, [0, 0, 0]],
        ]),
        track(hipsBone, [[0, turn(Y, 14)], [0.3, turn(Y, -14)], [0.6, turn(Y, 14)], [0.9, turn(Y, -14)], [1.2, turn(Y, 14)]]),
        track(index.J_Spine, [[0, turn(X, 8)], [0.3, turn(X, 4)], [0.6, turn(X, 8)], [0.9, turn(X, 4)], [1.2, turn(X, 8)]]),
        // The pointing arm, stabbing up and not quite coming back down. It
        // stops at 118 for the same reason the wave does.
        track(arms.R, [[0, turn(Z, -118)], [0.15, turn(Z, -100)], [0.3, turn(Z, -118)], [0.45, turn(Z, -100)], [0.6, turn(Z, -118)], [0.75, turn(Z, -100)], [0.9, turn(Z, -118)], [1.05, turn(Z, -100)], [1.2, turn(Z, -118)]]),
        track(elbows.R, [[0, turn(Z, 0)], [1.2, turn(Z, 0)]]),
        /*
         * The other hand in at the waist, which is the elbow folded rather
         * than the shoulder lifted. The shoulder was at 48 first and the arm
         * read as a second raised arm rather than a hand on a hip - the
         * whole shape of this one is one arm up and one arm down, and two
         * arms out is a different clip.
         */
        track(arms.L, [[0, turn(Z, 8)], [1.2, turn(Z, 8)]]),
        track(elbows.L, [[0, turn(X, -82)], [0.3, turn(X, -70)], [0.6, turn(X, -82)], [0.9, turn(X, -70)], [1.2, turn(X, -82)]]),
        track(knees.L, [[0, turn(X, -26)], [0.15, turn(X, -6)], [0.3, turn(X, -26)], [0.45, turn(X, -6)], [0.6, turn(X, -26)], [0.75, turn(X, -6)], [0.9, turn(X, -26)], [1.05, turn(X, -6)], [1.2, turn(X, -26)]]),
        track(knees.R, [[0, turn(X, -26)], [0.15, turn(X, -6)], [0.3, turn(X, -26)], [0.45, turn(X, -6)], [0.6, turn(X, -26)], [0.75, turn(X, -6)], [0.9, turn(X, -26)], [1.05, turn(X, -6)], [1.2, turn(X, -26)]]),
        track(index.J_Head, [[0, turn(Y, -8)], [0.3, turn(Y, 8)], [0.6, turn(Y, -8)], [0.9, turn(Y, 8)], [1.2, turn(Y, -8)]]),
      ],
    },
    {
      /*
       * The twist: hips one way, chest the other, head following the chest.
       * The counter-rotation is the whole clip, and it is why this one is
       * kept to a modest bob - two opposed turns are already a lot of
       * movement on a body this square.
       *
       * It does not spin. A full turn written as quaternions interpolates
       * the short way round and a 180 degree key has no short way, so it
       * would either snap or reverse halfway; the twist gets the same idea
       * across and plays the same every time.
       */
      name: 'dance3',
      tracks: [
        shift(hipsBone, [
          [0, [0, 0, 0]], [0.5, [0, 0.18, 0]], [1.0, [0, 0, 0]],
          [1.5, [0, 0.18, 0]], [2.0, [0, 0, 0]],
        ]),
        track(hipsBone, [[0, turn(Y, 30)], [1.0, turn(Y, -30)], [2.0, turn(Y, 30)]]),
        track(index.J_Spine, [[0, turn(Y, -14)], [1.0, turn(Y, 14)], [2.0, turn(Y, -14)]]),
        track(index.J_Chest, [[0, turn(Y, -26)], [1.0, turn(Y, 26)], [2.0, turn(Y, -26)]]),
        /*
         * Elbows up, forearms folded back toward the shoulders, carried by
         * the chest rather than swinging on their own.
         *
         * They were straight out at 68 to 84 first, which is a T-pose with
         * a wobble: arms held level read as stiff whatever the rest of the
         * body is doing, and on a twist they hid the one thing the clip is
         * about. The fold is on Z, not X - an X bend takes the forearm
         * toward the camera, where a view from the front cannot see it.
         */
        track(arms.L, [[0, turn(Z, 30)], [1.0, turn(Z, 42)], [2.0, turn(Z, 30)]]),
        track(arms.R, [[0, turn(Z, -42)], [1.0, turn(Z, -30)], [2.0, turn(Z, -42)]]),
        track(elbows.L, [[0, turn(Z, 96)], [0.5, turn(Z, 72)], [1.0, turn(Z, 96)], [1.5, turn(Z, 72)], [2.0, turn(Z, 96)]]),
        track(elbows.R, [[0, turn(Z, -72)], [0.5, turn(Z, -96)], [1.0, turn(Z, -72)], [1.5, turn(Z, -96)], [2.0, turn(Z, -72)]]),
        // Knees a little apart and bent, which is what lets the hips turn
        // that far without the feet reading as glued down.
        track(hips.L, [[0, turn(Z, 7)], [1.0, turn(Z, 7)], [2.0, turn(Z, 7)]]),
        track(hips.R, [[0, turn(Z, -7)], [1.0, turn(Z, -7)], [2.0, turn(Z, -7)]]),
        track(knees.L, [[0, turn(X, -30)], [0.5, turn(X, -18)], [1.0, turn(X, -30)], [1.5, turn(X, -18)], [2.0, turn(X, -30)]]),
        track(knees.R, [[0, turn(X, -30)], [0.5, turn(X, -18)], [1.0, turn(X, -30)], [1.5, turn(X, -18)], [2.0, turn(X, -30)]]),
        track(index.J_Head, [[0, turn(Y, -18)], [1.0, turn(Y, 18)], [2.0, turn(Y, -18)]]),
      ],
    },
  ]
}
