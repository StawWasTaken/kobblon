import * as THREE from 'three'

/**
 * What a part is made of.
 *
 * An enum rather than a texture library, on purpose: a creator picks from a
 * list they can hold in their head, every World costs the same to load, and
 * nothing here has to be moderated. A material decides how a colour responds
 * to light, and the colour stays the creator's.
 */
export type Material =
  | 'plastic' | 'wood' | 'metal' | 'brick'
  | 'grass' | 'sand' | 'concrete' | 'glass' | 'neon'

export const MATERIALS: Material[] = [
  'plastic', 'wood', 'metal', 'brick', 'grass', 'sand', 'concrete', 'glass', 'neon',
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
  plastic: { roughness: 0.55, metalness: 0 },
  wood: { roughness: 0.82, metalness: 0 },
  metal: { roughness: 0.28, metalness: 0.9 },
  brick: { roughness: 0.95, metalness: 0 },
  grass: { roughness: 1, metalness: 0 },
  sand: { roughness: 0.98, metalness: 0 },
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

  const material = new THREE.MeshStandardMaterial({
    color: look.colour,
    roughness: THREE.MathUtils.clamp(base.roughness * (1 - look.reflectance * 0.85), 0.02, 1),
    metalness: THREE.MathUtils.clamp(base.metalness + look.reflectance * 0.6, 0, 1),
    transparent: clear > 0.001,
    opacity: 1 - clear,
    // A pane you can see through should still be a pane from behind.
    side: clear > 0.001 ? THREE.DoubleSide : THREE.FrontSide,
  })

  if (base.emissive) {
    material.emissive = new THREE.Color(look.colour)
    material.emissiveIntensity = base.emissive
  }

  cache.set(key, material)
  return material
}
