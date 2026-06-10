import type { StarPlacement } from "./generateStarPositions";
import * as THREE from "three";
import {
  createDefaultCamera,
  DEFAULT_CAMERA_POSITION,
} from "./cameraConfig";
import {
  ARM_SWEEP,
  CORE_RADIUS,
  DUST_T_MAX,
  MAX_RADIUS,
} from "./galaxySpiralMath";
import { hashSeed } from "./outerSkyMath";
import {
  OUTER_HOLDER_CAM_DIST_MAX,
  OUTER_HOLDER_CAM_DIST_MIN,
  OUTER_STAR_NDC_LIMIT,
} from "./placeOuterHolderStar";

const GALAXY_SCALE = 1.15;
const ARM_HALO_PADDING = 14;
const DEEP_SPACE_CLEARANCE = 30;

const _camera = createDefaultCamera();
const _cameraPos = DEFAULT_CAMERA_POSITION.clone();
const _ndc = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _position = new THREE.Vector3();
const _projected = new THREE.Vector3();

function deepSpaceMinRadius(): number {
  const k = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
  const outerStructureR = CORE_RADIUS * Math.exp(k * DUST_T_MAX * ARM_SWEEP);
  return (outerStructureR + ARM_HALO_PADDING) * GALAXY_SCALE + DEEP_SPACE_CLEARANCE;
}

const R_INNER = deepSpaceMinRadius();

function hashUnit(hash: number, shift: number): number {
  return ((hash >>> shift) % 100000) / 100000;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function rayFromNdc(ndcX: number, ndcY: number): THREE.Vector3 {
  _ndc.set(ndcX, ndcY, 0.5);
  _ndc.unproject(_camera);
  return _rayDir.copy(_ndc).sub(_cameraPos).normalize();
}

function validCameraDistanceRange(
  dir: THREE.Vector3,
): { tMin: number; tMax: number } | null {
  let tMin = OUTER_HOLDER_CAM_DIST_MIN;
  let tMax = OUTER_HOLDER_CAM_DIST_MAX;

  const cd = _cameraPos.dot(dir);
  const c2 = _cameraPos.lengthSq();
  const disc = cd * cd - (c2 - R_INNER * R_INNER);

  if (disc >= 0) {
    const sqrtDisc = Math.sqrt(disc);
    const tExit = -cd + sqrtDisc;
    const tEnter = -cd - sqrtDisc;

    if (tExit > 0) {
      tMin = Math.max(tMin, tExit + 0.5);
    }
    if (tEnter > 0) {
      tMax = Math.min(tMax, tEnter - 0.5);
    }
  }

  if (tMax <= tMin) return null;
  return { tMin, tMax };
}

function positionOnRay(
  dir: THREE.Vector3,
  t: number,
): [number, number, number] {
  _position.copy(_cameraPos).addScaledVector(dir, t);
  return [_position.x, _position.y, _position.z];
}

function distanceFromCenter(position: [number, number, number]) {
  const [x, y, z] = position;
  return Math.sqrt(x * x + y * y + z * z);
}

function projectNdc(position: [number, number, number]) {
  _projected.set(...position).project(_camera);
  return { x: _projected.x, y: _projected.y, z: _projected.z };
}

function isVisiblePlacement(position: [number, number, number]) {
  const ndc = projectNdc(position);
  const limit = OUTER_STAR_NDC_LIMIT;
  const camDist = _cameraPos.distanceTo(_position.set(...position));

  return (
    ndc.z >= -1 &&
    ndc.z <= 1 &&
    ndc.x >= -limit &&
    ndc.x <= limit &&
    ndc.y >= -limit &&
    ndc.y <= limit &&
    camDist >= OUTER_HOLDER_CAM_DIST_MIN &&
    camDist <= OUTER_HOLDER_CAM_DIST_MAX &&
    distanceFromCenter(position) >= R_INNER
  );
}

function depthTFromHash(hash: number, salt: number): number {
  return clamp(
    0.12 +
      hashUnit(hash, 7 + salt) * 0.76 +
      Math.sin(hashUnit(hash, 13 + salt) * Math.PI * 2) * 0.1,
    0,
    1,
  );
}

function placeOnRay(
  ndcX: number,
  ndcY: number,
  hash: number,
  salt: number,
): [number, number, number] | null {
  const dir = rayFromNdc(ndcX, ndcY);
  const range = validCameraDistanceRange(dir);
  if (!range) return null;

  const t = range.tMin + depthTFromHash(hash, salt) * (range.tMax - range.tMin);
  return positionOnRay(dir, t);
}

/** Screen-space quadrant from projected NDC (x+, y+ = NE). */
export function screenQuadrantFromNdc(ndcX: number, ndcY: number): 0 | 1 | 2 | 3 {
  if (ndcX >= 0 && ndcY >= 0) return 0;
  if (ndcX < 0 && ndcY >= 0) return 1;
  if (ndcX < 0 && ndcY < 0) return 2;
  return 3;
}

/**
 * NDC target spread across the full visible frame — corners, edges, all quadrants.
 */
function burnerNdcFromHash(hash: number, salt: number): [number, number] {
  const u0 = hashUnit(hash, 0 + salt * 4);
  const u1 = hashUnit(hash, 5 + salt * 4);
  const u2 = hashUnit(hash, 11 + salt * 4);
  const u3 = hashUnit(hash, 19 + salt * 4);
  const limit = OUTER_STAR_NDC_LIMIT;

  const theta = u0 * Math.PI * 2 + Math.sin(u1 * 6.7) * 0.2;
  const radial = 0.42 + Math.sqrt(u1) * 0.5 + u2 * 0.1;
  const r = Math.min(limit, radial * limit);

  let ndcX = r * Math.cos(theta) + Math.sin(u3 * 8.3) * 0.04;
  let ndcY = r * Math.sin(theta) + Math.cos(u3 * 5.1) * 0.04;

  return [
    clamp(ndcX, -limit, limit),
    clamp(ndcY, -limit, limit),
  ];
}

/**
 * Deterministic burner star placement at outer-holder depth band.
 * Enforces ≤30% of stars per screen quadrant when placing sequentially.
 */
export function placeBurnerStar(
  wallet: string,
  quadrantCounts: [number, number, number, number],
  totalStars: number,
): StarPlacement {
  const hash = hashSeed(wallet.toLowerCase());
  const maxPerQuadrant = Math.max(1, Math.ceil(totalStars * 0.3));

  let best: StarPlacement | null = null;
  let bestScore = -Infinity;

  for (let attempt = 0; attempt < 16; attempt++) {
    const [ndcX, ndcY] = burnerNdcFromHash(hash, attempt);
    const position = placeOnRay(ndcX, ndcY, hash, attempt);
    if (!position || !isVisiblePlacement(position)) continue;

    const projected = projectNdc(position);
    const quadrant = screenQuadrantFromNdc(projected.x, projected.y);
    const quadrantPenalty =
      quadrantCounts[quadrant] >= maxPerQuadrant ? -100 : 0;
    const edgeBonus =
      Math.hypot(projected.x, projected.y) * 2 +
      Math.min(Math.abs(projected.x), Math.abs(projected.y)) * 0.5;
    const score = edgeBonus + quadrantPenalty - attempt * 0.01;

    if (score > bestScore) {
      bestScore = score;
      best = {
        position,
        distanceFromCenter: distanceFromCenter(position),
      };
    }

    if (quadrantPenalty === 0 && score > 0.5) break;
  }

  if (best) {
    const projected = projectNdc(best.position);
    const quadrant = screenQuadrantFromNdc(projected.x, projected.y);
    quadrantCounts[quadrant] += 1;
    return best;
  }

  const [ndcX, ndcY] = burnerNdcFromHash(hash, 99);
  const fallback =
    placeOnRay(ndcX, ndcY, hash, 99) ??
    positionOnRay(
      rayFromNdc(ndcX * 0.7, ndcY * 0.7),
      (OUTER_HOLDER_CAM_DIST_MIN + OUTER_HOLDER_CAM_DIST_MAX) * 0.5,
    );
  const projected = projectNdc(fallback);
  const quadrant = screenQuadrantFromNdc(projected.x, projected.y);
  quadrantCounts[quadrant] += 1;

  return {
    position: fallback,
    distanceFromCenter: distanceFromCenter(fallback),
  };
}
