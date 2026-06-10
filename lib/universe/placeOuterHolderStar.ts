import type { StarPlacement } from "./generateStarPositions";
import * as THREE from "three";
import {
  createDefaultCamera,
  DEFAULT_CAMERA_FAR,
  DEFAULT_CAMERA_POSITION,
} from "./cameraConfig";
import {
  ARM_SWEEP,
  CORE_RADIUS,
  DUST_T_MAX,
  MAX_RADIUS,
} from "./galaxySpiralMath";
import { hashSeed } from "./outerSkyMath";

const GALAXY_SCALE = 1.15;
const ARM_HALO_PADDING = 14;
const DEEP_SPACE_CLEARANCE = 30;

/** 5% inset from each screen edge → NDC half-extent 0.9. */
export const OUTER_STAR_NDC_MARGIN = 0.05;
export const OUTER_STAR_NDC_LIMIT = 1 - OUTER_STAR_NDC_MARGIN * 2;

const CAMERA_FAR_LIMIT = DEFAULT_CAMERA_FAR * 0.96;
const MIN_CAMERA_DEPTH = 1.2;

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

/** Deterministic NDC target with organic patch bias — never a grid. */
function ndcFromHash(hash: number): [number, number] {
  const u0 = hashUnit(hash, 0);
  const u1 = hashUnit(hash, 5);
  const u2 = hashUnit(hash, 11);
  const u3 = hashUnit(hash, 19);
  const patch =
    Math.sin(u0 * 9.2 + u1 * 6.3) * 0.5 +
    Math.cos(u0 * 4.1 - u1 * 3.7) * 0.35;

  const bx = (u0 * 0.64 + u2 * 0.36) * 2 - 1;
  const by = (u1 * 0.72 + u3 * 0.28) * 2 - 1;
  const limit = OUTER_STAR_NDC_LIMIT;

  return [
    clamp(bx * limit + patch * 0.07, -limit, limit),
    clamp(by * limit + patch * 0.05, -limit, limit),
  ];
}

function rayFromNdc(ndcX: number, ndcY: number): THREE.Vector3 {
  _ndc.set(ndcX, ndcY, 0.5);
  _ndc.unproject(_camera);
  return _rayDir.copy(_ndc).sub(_cameraPos).normalize();
}

/**
 * Valid camera-depth interval where the point stays in deep space,
 * in front of the camera, and within the far plane.
 */
function validDepthRange(dir: THREE.Vector3): { tMin: number; tMax: number } {
  const cd = _cameraPos.dot(dir);
  const c2 = _cameraPos.lengthSq();
  const rMin = R_INNER;
  const minDistSq = c2 - cd * cd;
  const disc = cd * cd - (c2 - rMin * rMin);

  let tMin = MIN_CAMERA_DEPTH;
  let tMax = CAMERA_FAR_LIMIT;

  if (minDistSq < rMin * rMin && disc > 0) {
    const sqrtDisc = Math.sqrt(disc);
    const tExit = -cd + sqrtDisc;
    const tEnter = -cd - sqrtDisc;

    if (tExit > MIN_CAMERA_DEPTH && tExit < tMax) {
      tMin = Math.max(MIN_CAMERA_DEPTH, tExit + 0.5);
    } else if (tEnter > MIN_CAMERA_DEPTH) {
      tMax = Math.min(tMax, tEnter - 0.5);
      tMin = MIN_CAMERA_DEPTH;
    }
  }

  if (tMax <= tMin) {
    tMin = MIN_CAMERA_DEPTH;
    tMax = CAMERA_FAR_LIMIT;
  }

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
    camDist <= CAMERA_FAR_LIMIT &&
    camDist >= MIN_CAMERA_DEPTH &&
    distanceFromCenter(position) >= R_INNER
  );
}

/**
 * Deterministic deep-space placement from wallet hash — every holder
 * beyond rank 75 projects inside the default camera frame (5% margin),
 * stays beyond the galaxy arms, and remains within the far plane.
 */
export function placeOuterHolderStar(wallet: string): StarPlacement {
  const hash = hashSeed(wallet.toLowerCase());
  const [ndcX, ndcY] = ndcFromHash(hash);
  const dir = rayFromNdc(ndcX, ndcY);
  const { tMin, tMax } = validDepthRange(dir);

  const depthT =
    0.28 +
    hashUnit(hash, 7) * 0.52 +
    Math.sin(hashUnit(hash, 13) * Math.PI * 2) * 0.12;
  let t = tMin + depthT * (tMax - tMin);

  let position = positionOnRay(dir, t);

  if (!isVisiblePlacement(position)) {
    for (let i = 1; i <= 6; i++) {
      const retryT = tMin + ((hashUnit(hash, 20 + i) * 0.86 + 0.07) % 1) * (tMax - tMin);
      position = positionOnRay(dir, retryT);
      if (isVisiblePlacement(position)) break;
    }
  }

  if (!isVisiblePlacement(position)) {
    const fallbackDir = rayFromNdc(ndcX * 0.55, ndcY * 0.55);
    const fallbackRange = validDepthRange(fallbackDir);
    const fallbackT =
      fallbackRange.tMin +
      0.5 * (fallbackRange.tMax - fallbackRange.tMin);
    position = positionOnRay(fallbackDir, fallbackT);
  }

  return {
    position,
    distanceFromCenter: distanceFromCenter(position),
  };
}

/** Reference minimum deep-space radius (beyond visible arms). */
export function outerHolderMinRadius() {
  return R_INNER;
}
