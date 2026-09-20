import * as THREE from 'three'
import { bumpFor, reliefFor, textureFor } from './textures'

/**
 * What a part is made of.
 *
 * An enum rather than a texture library, on purpose: a creator picks from a
 * list they can hold in their head, every World costs the same to load, and
 * nothing here has to be moderated. A material decides how a colour responds
 * to light, and the colour stays the creator's.
 */
export type Material =
  | 'smooth' | 'plastic' | 'stons' | 'wood' | 'planks' | 'metal' | 'plate'
  | 'brick' | 'grass' | 'sand' | 'pebble' | 'slate' | 'marble' | 'concrete'
  | 'glass' | 'neon'

export const MATERIALS: Material[] = [
  'smooth', 'plastic', 'stons', 'wood', 'planks', 'metal', 'plate', 'brick',
  'grass', 'sand', 'pebble', 'slate', 'marble', 'concrete', 'glass', 'neon',
]

type Look = {
  roughness: number
  metalness: number
  /** Lifts the colour so a material reads without a texture behind it. */
  emissive?: number
  /** What the material does on its own, before a part asks for it. */
  transparency?: number
}

/*
 * Numbers chosen by looking at them, not by copying a reference chart: these
 * have to tell each other apart at a glance on a blocky avatar's world, which
 * is a different job from being physically right.
 */
const LOOKS: Record<Material, Look> = {
  /*
   * Plastic with nothing on it. Not an oversight: a clean face is a thing
   * somebody wants, and the way to get it is a material that says so rather
   * than a texture everybody has to remember to turn off.
   */
  smooth: { roughness: 0.38, metalness: 0 },
  plastic: { roughness: 0.55, metalness: 0 },
  /*
   * Plastic with a ston on every ston.
   *
   * The same plastic underneath, and a surface you can count. A part made of
   * this says how big it is without anybody having to click it, and that is
   * what the unit is named after: a ston is the square you can see.
   */
  stons: { roughness: 0.5, metalness: 0 },
  wood: { roughness: 0.82, metalness: 0 },
  /** Boards, laid and nailed, rather than one piece of grain. */
  planks: { roughness: 0.85, metalness: 0 },
  /*
   * Not fully metal on purpose. A metal with nothing to reflect renders
   * black, and a World is not guaranteed to have a sky. This keeps the
   * highlight and the colour; a World with a sky gets the reflection too,
   * because the engine hands the sky to the scene as its environment.
   */
  metal: { roughness: 0.35, metalness: 0.55 },
  /** Tread plate. The same metal, rougher, because it is made not to be slid on. */
  plate: { roughness: 0.5, metalness: 0.5 },
  brick: { roughness: 0.95, metalness: 0 },
  grass: { roughness: 1, metalness: 0 },
  sand: { roughness: 0.98, metalness: 0 },
  /** Small stones set in something. Rough, and never shiny. */
  pebble: { roughness: 1, metalness: 0 },
  /** Split stone. Flat, matte, and darker in its hollows than marble is. */
  slate: { roughness: 0.88, metalness: 0.04 },
  /** Polished stone: the one rough material that answers light. */
  marble: { roughness: 0.22, metalness: 0.1 },
  concrete: { roughness: 0.9, metalness: 0.05 },
  glass: { roughness: 0.08, metalness: 0.1, transparency: 0.75 },
  neon: { roughness: 0.4, metalness: 0, emissive: 0.9 },
}

export const isMaterial = (value: unknown): value is Material =>
  typeof value === 'string' && (MATERIALS as string[]).includes(value)

export type PartLook = {
  colour: string
  material: Material
  /** 0 is solid, 1 is invisible. */
  transparency: number
  /** 0 is flat, 1 is a mirror. Read on top of what the material does. */
  reflectance: number
}

/**
 * One material per combination rather than one per part: a World of ten
 * thousand bricks should not hold ten thousand materials that are all the
 * same brick.
 */
export function materialFor(look: PartLook, cache: Map<string, THREE.Material>) {
  const key = `${look.colour}|${look.material}|${look.transparency}|${look.reflectance}`
  const had = cache.get(key)
  if (had) return had

  const base = LOOKS[look.material] ?? LOOKS.plastic
  const clear = Math.max(look.transparency, base.transparency ?? 0)

  /*
   * The pattern is what makes a material read as itself. It is greyscale and
   * multiplies the colour the creator chose, so brick in Kobblon blue is
   * still recognisably brick.
   */
  const pattern = textureFor(look.material)

  /*
   * And the bumps. A picture on a flat face is a flat face with a picture on
   * it; the normal map is what makes the hollows catch light differently
   * from the faces, which is the whole difference between a brick wall and a
   * photograph of one.
   */
  const bumps = bumpFor(look.material)
  const relief = reliefFor(look.material)

  const material = new THREE.MeshStandardMaterial({
    color: look.colour,
    roughness: THREE.MathUtils.clamp(base.roughness * (1 - look.reflectance * 0.85), 0.02, 1),
    /*
     * The material's own metalness is kept moderate so that metal is not
     * black in a World with nothing to reflect. Reflectance is different:
     * a creator asking for a mirror gets one, and a mirror in a dark room
     * being dark is correct rather than broken.
     */
    metalness: THREE.MathUtils.clamp(base.metalness + look.reflectance * 0.7, 0, 0.95),
    transparent: clear > 0.001,
    opacity: 1 - clear,
    // A pane you can see through should still be a pane from behind.
    side: clear > 0.001 ? THREE.DoubleSide : THREE.FrontSide,
    ...(pattern ? { map: pattern } : {}),
    ...(bumps ? { normalMap: bumps, normalScale: new THREE.Vector2(relief, relief) } : {}),
  })

  if (base.emissive) {
    material.emissive = new THREE.Color(look.colour)
    material.emissiveIntensity = base.emissive
  }

  cache.set(key, material)
  return material
}
