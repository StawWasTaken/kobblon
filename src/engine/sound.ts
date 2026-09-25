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

export class SoundService {
  /** Every sound this World has, by its id when it was given one. */
  readonly all: Playing[] = []
  private byId = new Map<string, Playing>()
  private listener: THREE.AudioListener | null = null
  private loader = new THREE.AudioLoader()

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
       * The World this sound belongs to may have been closed while its file
       * was coming. Starting it now would leave a World nobody is in making
       * a noise, on a service that has already been cleared and will never
       * be cleared again — which is a sound that plays for ever.
       */
      if (!stillWanted()) return

      const node = one.at
        ? new THREE.PositionalAudio(listener)
        : new THREE.Audio(listener)
      node.setBuffer(buffer)
      node.setLoop(one.sound.loop === true)
      node.setVolume(one.sound.volume ?? 1)
      if (one.at && node instanceof THREE.PositionalAudio) {
        // How far it carries. Past this it is there and inaudible, which is
        // what a distant thing is.
        node.setRefDistance(Math.max((one.sound.reach ?? 40) / 4, 0.5))
        node.setMaxDistance(one.sound.reach ?? 40)
        one.at.add(node)
      }

      one.node = node
      one.loaded = true
      // It was asked for while it was still coming, so it starts now.
      if (one.wanted) this.start(one)
    }))

    return this.all
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
    if (one.node?.isPlaying) one.node.stop()
    return true
  }

  private start(one: Playing) {
    if (!one.node || one.node.isPlaying) return
    // A browser will not make a noise before somebody has touched the page,
    // and refusing is normal rather than an error.
    one.node.context.resume?.().catch(() => {})
    one.node.play()
  }

  /** Everything this World was making noise with, let go of. */
  clear() {
    for (const one of this.all) {
      if (one.node?.isPlaying) one.node.stop()
      one.node?.disconnect()
      one.node?.removeFromParent()
    }
    this.all.length = 0
    this.byId.clear()
  }

  dispose() {
    this.clear()
    this.listener?.removeFromParent()
    this.listener = null
  }
}
