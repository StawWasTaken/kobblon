/**
 * The Kobblon Engine.
 *
 * Everything a client needs to run an experience, and nothing about Kobblon
 * the website. Creator and the Launcher import this; the web app does not run
 * experiences at all, it points at them.
 */
export { Engine, type EngineOptions, type EngineEvents } from './engine'
export { Controller, type Solid, type ControllerState } from './controller'
export { Keyboard, stillIntent, type Intent } from './input'
export {
  K6, K6_PARTS, K6_POINTS, K6_FACE_SIZE, loadK6Source, forgetK6Source, fitToSocket,
  type WornFit,
  type K6Part, type K6Look, type K6Motion, type K6Point,
} from './k6'
export { blockify, headshot, PLACES } from './body'
export { dressFrom, type WornLook } from './dress'
export {
  BODY, COVERS, SIDES, PIXELS_PER_STON, templateFor, wrapToTemplate,
  drawTemplate, type BodyPart, type Clothing, type Side, type Template,
  type Region,
} from './clothes'
export {
  meshFormats, formatOf, carriesMaterials, loadMesh, hasSomethingToDraw,
  wearTexture, projectUv, frameMesh, lightForLooking, releaseMesh,
  lookFrom, LOOK_YAW, LOOK_PITCH, type MeshFormat,
} from './meshes'
export {
  buildWorld, buildExperience, readManifest, writeManifest, applyDecals, applyMeshes,
  layDecal, FACES, CLASSES,
  ZOOM_NEAR, ZOOM_FAR,
  type WorldManifest, type WorldBlock, type WorldGroup, type WorldPart, type BuiltWorld,
  type WorldDecal, type WorldSound, type WorldLight, type Vec3,
  type WorldNode, type WorldClass, type WorldScript,
  MOST_LIGHTS,
  type Face, type ExperienceManifest, type ExperienceBlock, type BuiltExperience,
} from './experience'
export { SoundService, type Playing } from './sound'
export {
  ChatService, LocalEcho, clean, muted, tintFor, NAME_TINTS, MOST_CHARACTERS,
  type ChatLine, type ChatKind, type ChatMark, type ChatTransport, type ChatEvents,
  type ScreenSay,
} from './chat'
export { ChatWindow } from './chatui'
export { BubbleBoard, BUBBLE_LOOK, type BubbleLook, type BubbleContents } from './bubbles'
export { MATERIALS, isMaterial, materialFor, type Material, type PartLook } from './materials'
export { SHAPES, isShape, geometryFor, tiledGeometry, TRUSS_BAY, type Shape } from './shapes'
export { textureFor, bumpFor, reliefFor, setTextureBase, TILES_PER_STON, PICTURED } from './textures'
export { buildSky, cutCross, Skybox, type Sky, type ResolveAsset } from './sky'
export { SOCKET_FOR, socketFor } from './k6'
export { STON, GRAVITY, K6_HEIGHT, K6_RADIUS } from './units'
