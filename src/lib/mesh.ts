/*
 * Reading a mesh file.
 *
 * The implementation is `@/engine/meshes`, because the engine needs it and
 * the engine imports nothing from `@/` - it is vendored whole by the
 * Workspace. This is the website's door onto it, so that the upload card
 * and the item page do not have to know that.
 */
export {
  meshFormats, formatOf, carriesMaterials, loadMesh, hasSomethingToDraw,
  wearTexture, projectUv, frameMesh, lightForLooking, releaseMesh,
  lookFrom, LOOK_YAW, LOOK_PITCH,
} from '@/engine/meshes'
export type { MeshFormat } from '@/engine/meshes'
