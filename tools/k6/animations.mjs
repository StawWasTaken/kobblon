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

/**
 * Two turns at once, as one quaternion.
 *
 * `turn` only does a single axis, which is enough for a limb that swings in
 * a plane and not enough for a wave: an arm raised straight out to the side
 * is edge-on to a camera standing in front of the avatar, so the whole
 * gesture happens in the one direction nobody is looking from. Bringing it a
 * little forward as well needs the two composed.
 *
 * Hamilton product, `a` applied after `b`. The order matters and the way to
 * know you have it the right way round is to look at it, which is what
 * `npm run k6:look` is for.
 */
function spin(a, b) {
  const [ax, ay, az, aw] = a
  const [bx, by, bz, bw] = b
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ]
}

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

/**
 * The same clip, played in less time.
 *
 * Every key's moment is divided, so the shape of the dance is untouched and
 * only its tempo moves. Written as a wrapper rather than by editing a
 * hundred numbers in place, because a hand-scaled clip is a clip where one
 * key got missed and the loop no longer meets itself.
 */
const quicker = (by, tracks) => tracks.map((one) => ({
  ...one,
  times: one.times.map((at) => Number((at / by).toFixed(4))),
}))

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
       * Redrawn twice. Round 286 raised the arm out to the side and flapped
       * the forearm a few degrees there; Staw looked at it in a World and
       * said it sucks, and he is right - the screenshot is an arm held out
       * stiff at shoulder height with a small wobble on the end of it.
       *
       * What was missing is the bend. A wave is an upper arm held roughly
       * level and a forearm standing straight up off it, and the waving is
       * the forearm rocking around that - the hand goes somewhere, which is
       * the whole read of the gesture. The old one kept the arm nearly
       * straight, so the hand travelled about a hand's width and the arm
       * read as raised rather than waving.
       *
       * **The swing is in the shoulder, and the elbow only decorates it.**
       * That is the important part and it is not a style choice. Staw: the
       * rigs this actually plays on are not this one, they "dont have lots
       * of limbs" - and a rig with no elbow bone simply drops the elbow
       * channel. Every version of this clip before now put the entire wave
       * in the elbow, so on those rigs it came out as a straight arm held
       * out stiff, which is precisely what his screenshot from a World
       * shows. The clip was not wrong there; it was wrong here, and the
       * preview rig's extra joints hid it.
       *
       * So the hand has to get somewhere using the shoulder alone. It rocks
       * through twenty-odd degrees, which is a real sweep on a limb that
       * long, and the elbow bends the same way on top of it. On a rig with
       * elbows that reads as a hand waving off a steady arm; on a rig
       * without, the whole arm waves from the shoulder, which is how a
       * blocky avatar with six parts waves and is still unmistakably a
       * wave. Neither one is the stiff arm.
       *
       * It stays on one axis. An earlier pass brought the arm forward as
       * well, on the reasoning that an arm straight out to the side is
       * edge-on to a camera in front - which is wrong, and looking at it is
       * what showed it: an arm raised sideways is edge-on from the *side*,
       * and square to the front, where the camera is. The forward turn only
       * dragged the elbow down and tilted the plane the forearm waves in.
       */
      name: 'wave',
      tracks: [
        /*
         * Up, overshooting, and then the wave itself in the shoulder:
         * between -98 and -120, three passes, each a little smaller than
         * the one before so it winds down rather than ticking like a
         * metronome. -120 is the limit where the top cap of the arm starts
         * to leave the body, and it is touched in passing rather than held.
         */
        track(arms.R, [
          [0, turn(Z, 4)],
          [0.22, turn(Z, -120)],
          [0.36, turn(Z, -108)],
          [0.58, turn(Z, -120)], [0.8, turn(Z, -98)],
          [1.02, turn(Z, -119)], [1.24, turn(Z, -100)],
          [1.46, turn(Z, -116)], [1.62, turn(Z, -108)],
          [1.95, turn(Z, 4)],
        ]),
        /*
         * The forearm standing up off it, bending with the swing rather
         * than against it, so the two add up instead of cancelling. -74 is
         * a few degrees off vertical and puts the hand above the head.
         *
         * Every key here is timed to a shoulder key. That is what makes the
         * clip read the same on both rigs: drop this track and the motion
         * underneath is already the gesture.
         */
        track(elbows.R, [
          [0.1, turn(Z, 0)],
          [0.36, turn(Z, -74)],
          [0.58, turn(Z, -92)], [0.8, turn(Z, -46)],
          [1.02, turn(Z, -90)], [1.24, turn(Z, -48)],
          [1.46, turn(Z, -84)], [1.62, turn(Z, -74)],
          [1.95, turn(Z, 0)],
        ]),
        // Leaning very slightly onto the other foot, which is what a person
        // does when one arm goes up, and the head turning to whoever it is for.
        track(index.J_Spine, [[0, still], [0.3, turn(Z, 6)], [1.62, turn(Z, 6)], [1.95, still]]),
        track(index.J_Head, [[0, still], [0.45, turn(Y, -14)], [1.5, turn(Y, -14)], [1.95, still]]),
        // The idle arm stops breathing for the duration rather than drifting
        // against the wave.
        track(arms.L, [[0, turn(X, -3)], [0.3, turn(X, -8)], [1.62, turn(X, -8)], [1.95, turn(X, -3)]]),
      ],
    },
    {
      /*
       * A shrug: I do not know, and I am not going to pretend otherwise.
       *
       * **This rig has no collarbone.** The sixteen bones go shoulder
       * straight to chest, so the shoulders cannot be lifted, which is the
       * one movement a shrug is named after. Rotating the arms up instead
       * gives a surrender, not a shrug.
       *
       * So the lift comes from the chest, as a small translation - the whole
       * upper body rising a little carries the arms and the head with it,
       * which is close enough to the real thing to read at a distance and
       * is honest about what the rig can do. The rest is in the arms turning
       * out with the forearms levelling off, palms up, and the head tipping.
       *
       * It holds at the top. A shrug that goes straight back down is a
       * twitch; the hold is the part that means the question was heard.
       */
      name: 'shrug',
      tracks: [
        shift(index.J_Chest, [
          [0, [0, 0, 0]], [0.3, [0, 0.16, 0]],
          [1.15, [0, 0.16, 0]], [1.5, [0, 0, 0]],
        ]),
        // Elbows coming away from the ribs, not arms going up.
        track(arms.L, [[0, turn(Z, 2)], [0.3, turn(Z, 36)], [1.15, turn(Z, 36)], [1.5, turn(Z, 2)]]),
        track(arms.R, [[0, turn(Z, -2)], [0.3, turn(Z, -36)], [1.15, turn(Z, -36)], [1.5, turn(Z, -2)]]),
        /*
         * Forearms out and a touch forward, which is where hands turned
         * palm-up end up. The fold is on Z with a little X on it for the
         * same reason the wave has: straight out to the sides is the one
         * place a camera in front cannot see.
         */
        track(elbows.L, [
          [0, turn(Z, 0)],
          [0.3, spin(turn(Z, 96), turn(X, -32))],
          [1.15, spin(turn(Z, 96), turn(X, -32))],
          [1.5, turn(Z, 0)],
        ]),
        track(elbows.R, [
          [0, turn(Z, 0)],
          [0.3, spin(turn(Z, -96), turn(X, -32))],
          [1.15, spin(turn(Z, -96), turn(X, -32))],
          [1.5, turn(Z, 0)],
        ]),
        // The head tipping over and pulling back, which is the half of a
        // shrug that happens above the neck.
        track(index.J_Head, [
          [0, still], [0.3, spin(turn(Z, 13), turn(X, -9))],
          [1.15, spin(turn(Z, 13), turn(X, -9))], [1.5, still],
        ]),
        track(index.J_Spine, [[0, still], [0.3, turn(X, -4)], [1.15, turn(X, -4)], [1.5, still]]),
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
       * A step side to side, arms swinging together across the body.
       *
       * Written as a 1.8 second cycle and played in 1.2. Staw asked for it
       * faster: at 1.8 the sway was slow enough to read as somebody swaying
       * on the spot rather than dancing to anything. The keys are left at
       * the tempo they were drawn at and `quicker` moves them, so the shape
       * is untouched and only the speed changed.
       */
      name: 'dance1',
      tracks: quicker(1.5, [
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
      ]),
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
      // Drawn as a 2.0 second cycle and played in 1.25. It was the slowest
      // clip in the file and a twist that slow reads as stretching.
      tracks: quicker(1.6, [
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
      ]),
    },
  ]
}
