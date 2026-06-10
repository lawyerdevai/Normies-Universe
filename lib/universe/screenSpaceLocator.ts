import * as THREE from "three";
import {
  TOP_TIER_LOCATOR_CORE,
  TOP_TIER_LOCATOR_GLOW,
  TOP_TIER_LOCATOR_GLOW_OPACITY,
} from "./resolveSearch";

/** View depth where top-75 holder stars typically sit — calibrates locator size. */
const REFERENCE_VIEW_Z = 165;

const RANK1_BASE_WORLD =
  TOP_TIER_LOCATOR_CORE + TOP_TIER_LOCATOR_GLOW * TOP_TIER_LOCATOR_GLOW_OPACITY;

/** Fixed on-screen highlight diameter — matches top-75 search drama. */
export const LOCATOR_HIGHLIGHT_SCREEN_PX =
  RANK1_BASE_WORLD * (235 / REFERENCE_VIEW_Z);

export function pixelWorldFactor(
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
): number {
  return (2 * Math.tan((camera.fov * Math.PI) / 360)) / viewportHeight;
}

export function worldUnitsForScreenPixels(
  worldPos: THREE.Vector3,
  camera: THREE.Camera,
  viewportHeight: number,
  screenPixels: number,
): number {
  const persp = camera as THREE.PerspectiveCamera;
  const dist = worldPos.distanceTo(camera.position);
  const pixelWorld = pixelWorldFactor(persp, viewportHeight);
  return screenPixels * pixelWorld * dist;
}
