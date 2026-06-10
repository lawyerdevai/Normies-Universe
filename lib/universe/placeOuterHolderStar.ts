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

const GALAXY_SCALE = 1.15;
const ARM_HALO_PADDING = 14;
const DEEP_SPACE_CLEARANCE = 30;

/** Match galaxy holder depth — not the far plane (~480). */
export const OUTER_HOLDER_CAM_DIST_MIN = 140;
export const OUTER_HOLDER_CAM_DIST_MAX = 230;

/** 5% inset from each screen edge → NDC half-extent 0.9. */
export const OUTER_STAR_NDC_MARGIN = 0.05;
export const OUTER_STAR_NDC_LIMIT = 1 - OUTER_STAR_NDC_MARGIN * 2;

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

/**
 * Deterministic NDC target — polar spread biased toward frame edges
 * so holders sit in open sky around the galaxy, not over the arms.
 */
function ndcFromHash(hash: number): [number, number] {
  const u0 = hashUnit(hash, 0);
  const u1 = hashUnit(hash, 5);
  const u2 = hashUnit(hash, 11);
  const u3 = hashUnit(hash, 19);
  const limit = OUTER_STAR_NDC_LIMIT;

  const theta = u0 * Math.PI * 2 + Math.sin(u1 * 5.1 + u2 * 2.3) * 0.45;
  const radial =
    0.38 + Math.sqrt(u1) * 0.52 + u2 * 0.14 + Math.sin(u3 * 8.7) * 0.06;
  let r = Math.min(limit, radial * limit);

  let ndcX = r * Math.cos(theta) + Math.sin(u0 * 9.2 + u1 * 6.3) * 0.05;
  let ndcY = r * Math.sin(theta) + Math.cos(u0 * 4.1 - u1 * 3.7) * 0.04;

  const minR = 0.32 + u3 * 0.28;
  const mag = Math.hypot(ndcX, ndcY);
  if (mag > 0.001 && mag < minR) {
    const push = minR / mag;
    ndcX *= push;
    ndcY *= push;
  }

  return [
    clamp(ndcX, -limit, limit),
    clamp(ndcY, -limit, limit),
  ];
}

function rayFromNdc(ndcX: number, ndcY: number): THREE.Vector3 {
  _ndc.set(ndcX, ndcY, 0.5);
  _ndc.unproject(_camera);
  return _rayDir.copy(_ndc).sub(_cameraPos).normalize();
}

/**
 * Camera-distance interval (unit ray → t equals distance from camera)
 * inside the galaxy-depth band and outside the arm structure.
 */
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

/**
 * Deterministic placement from wallet hash — lateral spread across the
 * sky at galaxy depth (~140–230 from camera), beyond the arms, on-screen.
 */
export function placeOuterHolderStar(wallet: string): StarPlacement {
  const hash = hashSeed(wallet.toLowerCase());
  const [ndcX, ndcY] = ndcFromHash(hash);

  let position = placeOnRay(ndcX, ndcY, hash, 0);

  if (!position || !isVisiblePlacement(position)) {
    for (let i = 1; i <= 6; i++) {
      const retryNdcX = clamp(
        ndcX + (hashUnit(hash, 20 + i) - 0.5) * 0.35,
        -OUTER_STAR_NDC_LIMIT,
        OUTER_STAR_NDC_LIMIT,
      );
      const retryNdcY = clamp(
        ndcY + (hashUnit(hash, 27 + i) - 0.5) * 0.35,
        -OUTER_STAR_NDC_LIMIT,
        OUTER_STAR_NDC_LIMIT,
      );
      position = placeOnRay(retryNdcX, retryNdcY, hash, i);
      if (position && isVisiblePlacement(position)) break;
    }
  }

  if (!position || !isVisiblePlacement(position)) {
    position =
      placeOnRay(ndcX * 0.55, ndcY * 0.55, hash, 99) ??
      positionOnRay(
        rayFromNdc(ndcX * 0.55, ndcY * 0.55),
        (OUTER_HOLDER_CAM_DIST_MIN + OUTER_HOLDER_CAM_DIST_MAX) * 0.5,
      );
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
