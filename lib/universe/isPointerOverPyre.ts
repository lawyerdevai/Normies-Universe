import * as THREE from "three";
import { PYRE_RX } from "./generatePyre";
import { localToWorldPlacement } from "./holderStarBands";

const _projected = new THREE.Vector3();
const _edgeProjected = new THREE.Vector3();

/** Screen-space hit test for the Pyre cluster at the current pointer. */
export function isPointerOverPyre(
  pointer: THREE.Vector2,
  camera: THREE.Camera,
  viewport: { width: number; height: number },
): boolean {
  const px = (pointer.x * 0.5 + 0.5) * viewport.width;
  const py = (-pointer.y * 0.5 + 0.5) * viewport.height;

  const center = localToWorldPlacement(0, 0, 0).position;
  _projected.set(...center).project(camera);
  if (_projected.z > 1) return false;

  const cx = (_projected.x * 0.5 + 0.5) * viewport.width;
  const cy = (-_projected.y * 0.5 + 0.5) * viewport.height;
  const edge = localToWorldPlacement(PYRE_RX, 0, 0).position;
  _edgeProjected.set(...edge).project(camera);
  const ex = (_edgeProjected.x * 0.5 + 0.5) * viewport.width;
  const ey = (-_edgeProjected.y * 0.5 + 0.5) * viewport.height;
  const pyreRadius = Math.hypot(ex - cx, ey - cy);

  return Math.hypot(px - cx, py - cy) <= pyreRadius;
}
