import * as THREE from "three";
import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";
import {
  type QuadrantCounts,
  positionQuadrant,
} from "./angularBalance";
import { PYRE_EXCLUSION_MARGIN, localToWorldPlacement } from "./holderStarBands";
import { createDefaultCamera } from "./cameraConfig";

/** Screen-space buffer multiplier on the Pyre's projected bounds. */
export const PYRE_SCREEN_BUFFER = 1.5;

const _projected = new THREE.Vector3();

export type ScreenRect = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

function samplePyreBoundaryPoints(): [number, number, number][] {
  const rx = PYRE_RX * PYRE_EXCLUSION_MARGIN;
  const ry = PYRE_RY * PYRE_EXCLUSION_MARGIN;
  const rz = PYRE_RZ * PYRE_EXCLUSION_MARGIN;
  const samples: [number, number, number][] = [];

  const rings = 12;
  const meridians = 16;
  for (let i = 0; i <= rings; i++) {
    const v = (i / rings) * Math.PI - Math.PI / 2;
    const cosV = Math.cos(v);
    const sinV = Math.sin(v);
    for (let j = 0; j < meridians; j++) {
      const u = (j / meridians) * Math.PI * 2;
      samples.push([
        rx * cosV * Math.cos(u),
        ry * sinV,
        rz * cosV * Math.sin(u),
      ]);
    }
  }

  samples.push([rx, 0, 0], [-rx, 0, 0], [0, ry, 0], [0, -ry, 0], [0, 0, rz], [0, 0, -rz]);
  return samples;
}

/** Projected NDC bounds of the Pyre at the default camera view. */
export function pyreScreenBounds(camera = createDefaultCamera()): ScreenRect {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const local of samplePyreBoundaryPoints()) {
    const world = localToWorldPlacement(...local).position;
    _projected.set(...world).project(camera);
    minX = Math.min(minX, _projected.x);
    maxX = Math.max(maxX, _projected.x);
    minY = Math.min(minY, _projected.y);
    maxY = Math.max(maxY, _projected.y);
  }

  const cx = (minX + maxX) * 0.5;
  const cy = (minY + maxY) * 0.5;
  const halfW = ((maxX - minX) * 0.5) * PYRE_SCREEN_BUFFER;
  const halfH = ((maxY - minY) * 0.5) * PYRE_SCREEN_BUFFER;

  return {
    minX: cx - halfW,
    maxX: cx + halfW,
    minY: cy - halfH,
    maxY: cy + halfH,
  };
}

const DEFAULT_BOUNDS = pyreScreenBounds();

export function projectWorldToNdc(
  position: [number, number, number],
  camera = createDefaultCamera(),
): { x: number; y: number } {
  _projected.set(...position).project(camera);
  return { x: _projected.x, y: _projected.y };
}

export function isInPyreScreenZone(
  position: [number, number, number],
  bounds: ScreenRect = DEFAULT_BOUNDS,
  camera = createDefaultCamera(),
): boolean {
  const { x, y } = projectWorldToNdc(position, camera);
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

/** Move on the constant-radius sphere — preserves distance from the galaxy center. */
export function rotateOnSphereAtRadius(
  position: [number, number, number],
  deltaPhi: number,
  deltaTheta: number,
): [number, number, number] {
  const [x, y, z] = position;
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r < 1e-6) return position;

  const theta = Math.acos(Math.max(-1, Math.min(1, y / r)));
  const phi = Math.atan2(z, x);
  const newTheta = Math.max(0.05, Math.min(Math.PI - 0.05, theta + deltaTheta));
  const newPhi = phi + deltaPhi;
  const sinT = Math.sin(newTheta);

  return [
    r * sinT * Math.cos(newPhi),
    r * Math.cos(newTheta),
    r * sinT * Math.sin(newPhi),
  ];
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

type ClearCandidate = {
  position: [number, number, number];
  quadrantLoad: number;
  travel: number;
};

/**
 * Rotate deterministically on the constant-radius sphere until the default-camera
 * projection clears the Pyre. Alternates sweep direction by rank and prefers the
 * less crowded disc quadrant when multiple escapes exist.
 */
export function clearPyreScreenOverlap(
  position: [number, number, number],
  rank: number,
  seed: string,
  quadrantCounts: QuadrantCounts = [0, 0, 0, 0],
): [number, number, number] {
  if (!isInPyreScreenZone(position)) return position;

  const hash = hashSeed(`${seed.toLowerCase()}:${rank}`);
  const startPhi = ((hash % 1000) / 1000) * Math.PI * 2;
  const startTheta = (((hash >> 10) % 1000) / 1000 - 0.5) * Math.PI * 0.35;
  const phiDir = rank % 2 === 0 ? 1 : -1;
  const thetaDir = (hash >> 5) % 2 === 0 ? 1 : -1;
  const phiSteps = 72;
  const thetaSteps = 17;

  let best: ClearCandidate | null = null;

  for (let ti = 0; ti < thetaSteps; ti++) {
    const thetaMag = (ti / Math.max(1, thetaSteps - 1)) * Math.PI * 0.5;
    const deltaTheta = startTheta + thetaDir * (thetaMag - Math.PI * 0.25);

    for (let pi = 0; pi < phiSteps; pi++) {
      const phiMag = (pi / phiSteps) * Math.PI * 2;
      const deltaPhi = startPhi + phiDir * phiMag;
      const rotated = rotateOnSphereAtRadius(position, deltaPhi, deltaTheta);
      if (isInPyreScreenZone(rotated)) continue;

      const quadrant = positionQuadrant(rotated);
      const candidate: ClearCandidate = {
        position: rotated,
        quadrantLoad: quadrantCounts[quadrant],
        travel: Math.abs(deltaPhi) + Math.abs(deltaTheta) * 0.6,
      };

      if (
        !best ||
        candidate.quadrantLoad < best.quadrantLoad ||
        (candidate.quadrantLoad === best.quadrantLoad &&
          candidate.travel < best.travel)
      ) {
        best = candidate;
      }
    }
  }

  if (best) return best.position;

  return rotateOnSphereAtRadius(position, startPhi + phiDir * Math.PI, 0);
}

export function verifyPyreScreenExclusion(
  stars: { collectionRank: number; position: [number, number, number] }[],
) {
  const bounds = DEFAULT_BOUNDS;
  const violations = stars
    .filter((s) => isInPyreScreenZone(s.position, bounds))
    .map((s) => s.collectionRank);

  return {
    bounds,
    violations,
    allClear: violations.length === 0,
  };
}
