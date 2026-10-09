import * as THREE from 'three'
import type { BuiltWorld, WorldSound } from './experience'
import type { ResolveAsset } from './sky'

/**
 * The sound in a World.
 *
 * Two things a World has, kept apart on purpose:
 *
 * - **Loaded** is whether the file is here. A World fetches what it needs
 *   when it opens, and that takes as long as it takes.
 * - **Playing** is whether it is audible right now. That is a separate
 *   question, and it is the one a script will answer later.
 *
 * They are built as two things now rather than bolted apart afterwards,
 * because a sound that plays the moment it arrives cannot be asked to wait,
 * and every World written against that is already wrong.
 *
 * A sound named in a World's own list is everywhere at once, which is what
 * ambience is. A sound that is a child of a part comes from that part and
 * fades with distance, and moves when the part moves.
 */

export type Playing = {
  /** What the World said. */
  sound: WorldSound
  /** Where it is, or nothing when it is everywhere. */
  at: THREE.Object3D | null
  /** Whether the file is here yet. */
  loaded: boolean
  /** Whether it should be audible, whether or not it has arrived. */
  wanted: boolean
  node: THREE.Audio | THREE.PositionalAudio | null
}

/**
 * The things a sound does that somebody might be waiting for.
 *
 * `ended` does not fire for a looping sound, because a loop does not end -
 * which is the honest answer and also what Roblox does.
 */
export type SoundMoment = 'loaded' | 'played' | 'stopped' | 'ended'

export class SoundService {
  /** Every sound this World has, by its id when it was given one. */
  readonly all: Playing[] = []
  private byId = new Map<string, Playing>()
  private listener: THREE.AudioListener | null = null
  private loader = new THREE.AudioLoader()

  /*
   * Which set of sounds is wanted.
   *
   * Bumped by anything that ends the current set - loading another World,
   * clearing, disposing - and checked after every await, so a file that
   * arrives late knows nobody is waiting for it.
   *
   * It exists because the guard that was here counted the wrong thing. The
   * engine passed in `stillWanted`, which compares how many Worlds have been
   * *opened*; leaving a World opens nothing, so after `dispose()` the guard
   * still said yes. A fetch landing then built an audio node and started it,
   * outside `all` because `clear()` had already emptied it - so no later
   * clear could ever reach it. A sound playing for ever in a World nobody
   * is in, which is also both of the other two symptoms: a second engine
   * leaves the first one's orphan playing, and two copies of one buffer a
   * few hundred milliseconds apart through one AudioContext comb-filter
   * into something that sounds exactly like a bad encode. The files were
   * always fine.
   *
   * The engine's own guard is still honoured as well. Two questions, both
   * worth asking: has the player left this World, and has this service been
   * emptied since. The old one could only answer the first.
   */
  private generation = 0

  /*
   * Who wants telling when a sound does something.
   *
   * Staw's test for the script system is "a radio that plays one after
   * another, songs just like on roblox", and that is `Ended` and nothing
   * else: without it a script can start a song and has no way to know when
   * to start the next. So the events exist before the scripts do, rather
   * than being added once somebody notices a radio cannot be written.
   *
   * Emptied by `clear()` along with everything else - a watcher is for a
   * World, and the next World's sounds are not the ones it asked about.
   */
  private watchers = new Map<SoundMoment, Set<(one: Playing) => void>>()

  /**
   * Ears, on the camera.
   *
   * Nothing is made until this is called, because constructing an audio
   * context before a person has touched the page is how browsers decide a
   * site is the sort that plays things at people.
   */
  listenFrom(camera: THREE.Camera) {
    if (!this.listener) {
      if (typeof globalThis.AudioContext !== 'function') return null
      this.listener = new THREE.AudioListener()
    }
    if (this.listener.parent !== camera) camera.add(this.listener)
    return this.listener
  }

  /** A sound by the name the World gave it. */
  get(id: string) {
    return this.byId.get(id) ?? null
  }

  /**
   * Everything a World says it has, fetched.
   *
   * Loading does not make anything audible: a sound is heard when `playing`
   * said so, or when somebody asks afterwards.
   */
  async load(
    built: BuiltWorld,
    camera: THREE.Camera,
    resolveAsset?: ResolveAsset,
    stillWanted: () => boolean = () => true,
  ) {
    this.clear()
    const mine = this.generation
    /** Both questions: still this World, and still this set of sounds. */
    const current = () => stillWanted() && this.generation === mine

    const listener = this.listenFrom(camera)

    const wanted: Playing[] = []

    for (const ambient of built.manifest.sounds ?? []) {
      wanted.push({ sound: ambient, at: null, loaded: false, wanted: ambient.playing === true, node: null })
    }

    for (const [object, part] of built.partOf) {
      if (part.kind !== 'sound') continue
      wanted.push({ sound: part, at: object, loaded: false, wanted: part.playing === true, node: null })
    }

    for (const one of wanted) {
      this.all.push(one)
      if (one.sound.id) this.byId.set(one.sound.id, one)
    }

    if (!listener || !resolveAsset) return this.all

    await Promise.all(wanted.map(async (one) => {
      /*
       * A Catalog id, such as SND-1064, never an address: a World that can
       * name any host is a World that can make every player fetch anything.
       */
      const url = await resolveAsset(one.sound.sound).catch(() => null)
      if (!url) return
      const buffer = await this.loader.loadAsync(url).catch(() => null)
      if (!buffer) return

      /*
       * The World this sound belongs to may have been closed, or this
       * service emptied, while the file was coming. Checked before anything
       * is built rather than after, because the expensive mistake is not
       * the wasted node - it is the one that starts playing.
       */
      if (!current()) return

      const node = one.at
        ? new THREE.PositionalAudio(listener)
        : new THREE.Audio(listener)
      node.setBuffer(buffer)
      node.setLoop(one.sound.loop === true)
      node.setVolume(one.sound.volume ?? 1)
      node.setPlaybackRate(Math.max(one.sound.speed ?? 1, 0.01))

      /*
       * Duck-typed for the same reason as the `is*` flags elsewhere: two
       * copies of three.js make `instanceof` lie. PositionalAudio has no
       * flag of its own, and `panner` is the thing that makes it
       * positional, so it is the honest test.
       */
      const placed = node as THREE.PositionalAudio
      if (one.at && placed.panner) {
        const reach = Math.max(one.sound.reach ?? 40, 0.5)
        /*
         * Two distances, not one. Everything inside `near` is at full
         * volume; past it the sound falls away until `reach`, where it is
         * there and inaudible. The engine used to pass a quarter of `reach`
         * as the near distance for every sound, which is a guess, and most
         * of why these did not feel like Roblox's.
         */
        placed.setRefDistance(Math.min(Math.max(one.sound.near ?? reach / 4, 0.1), reach))
        placed.setMaxDistance(reach)
        placed.setDistanceModel(one.sound.falloff === 'linear' ? 'linear' : 'inverse')
        one.at.add(node)
      }

      one.node = node
      one.loaded = true
      this.announce(one, 'loaded')

      /*
       * The file arrived last, so what somebody asked for in the meantime
       * wins. `wanted` may have been turned off, or on, or off and on again
       * while this was in the air - and it is read now rather than captured
       * when the fetch started, which is the same mistake in a smaller coat.
       */
      if (one.wanted) this.start(one)
    }))

    return this.all
  }

  /**
   * Tells you when a sound does something. Hand back the returned function
   * to stop listening.
   */
  on(moment: SoundMoment, run: (one: Playing) => void) {
    const set = this.watchers.get(moment) ?? new Set()
    set.add(run)
    this.watchers.set(moment, set)
    return () => { set.delete(run) }
  }

  private announce(one: Playing, moment: SoundMoment) {
    for (const run of this.watchers.get(moment) ?? []) {
      // One watcher throwing is that watcher's problem, not the World's.
      try { run(one) } catch { /* a listener is not allowed to break the rest */ }
    }
  }

  /** Make it audible, now or as soon as it arrives. */
  play(id: string) {
    const one = this.byId.get(id)
    if (!one) return false
    one.wanted = true
    if (one.loaded) this.start(one)
    return true
  }

  stop(id: string) {
    const one = this.byId.get(id)
    if (!one) return false
    one.wanted = false
    if (one.node?.isPlaying) {
      one.node.stop()
      this.announce(one, 'stopped')
    }
    return true
  }

  /** Where it has got to, in seconds. Zero for anything not playing. */
  at(id: string) {
    const one = this.byId.get(id)
    return one?.node?.isPlaying ? (one.node as THREE.Audio).context.currentTime : 0
  }

  /** How fast it plays, changed while it is playing. */
  setSpeed(id: string, speed: number) {
    const one = this.byId.get(id)
    if (!one) return false
    one.sound = { ...one.sound, speed }
    one.node?.setPlaybackRate(Math.max(speed, 0.01))
    return true
  }

  private start(one: Playing) {
    if (!one.node || one.node.isPlaying) return
    // A browser will not make a noise before somebody has touched the page,
    // and refusing is normal rather than an error.
    one.node.context.resume?.().catch(() => {})

    /*
     * `ended` comes from the audio node rather than from a timer, because a
     * timer is wrong the moment the speed changes or the context is
     * suspended - which is exactly what happens on a tab nobody is looking
     * at. A looping sound never ends, so three.js never fires it, which is
     * the behaviour wanted rather than a gap.
     */
    const node = one.node
    const mine = this.generation
    node.onEnded = () => {
      /*
       * three.js types `isPlaying` as read-only but its own default handler
       * writes it, and the node is genuinely no longer playing. Left unset,
       * `start` refuses to play it a second time - which is a radio that
       * plays one song and stops.
       */
      ;(node as { isPlaying: boolean }).isPlaying = false
      if (this.generation !== mine) return
      one.wanted = false
      this.announce(one, 'ended')
    }

    if (one.sound.from) node.offset = Math.max(one.sound.from, 0)
    node.play()
    this.announce(one, 'played')
  }

  /** Everything this World was making noise with, let go of. */
  clear() {
    // First, so anything already in the air knows before it lands.
    this.generation += 1
    for (const one of this.all) {
      if (one.node?.isPlaying) one.node.stop()
      one.node?.disconnect()
      one.node?.removeFromParent()
      one.node = null
      one.loaded = false
    }
    this.all.length = 0
    this.byId.clear()
    this.watchers.clear()
  }

  dispose() {
    this.clear()
    this.listener?.removeFromParent()
    this.listener = null
  }
}
