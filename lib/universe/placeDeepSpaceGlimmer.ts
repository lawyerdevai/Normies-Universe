import * as THREE from "three";
import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";
import { MAX_RADIUS } from "./galaxySpiralMath";
import { outerHolderMinRadius } from "./placeOuterHolderStar";
import {
  createDefaultCamera,
  DEFAULT_CAMERA_POSITION,
} from "./cameraConfig";

const GALAXY_SCALE = 1.15;
const GALAXY_CLEARANCE = MAX_RADIUS * GALAXY_SCALE + 22;
const R_OUTER = 360;
const HOLDER_CLEARANCE = 24;
const PYRE_LIMIT = 1.34;

const _camera = createDefaultCamera();
const _cameraPos = DEFAULT_CAMERA_POSITION.clone();
const _projected = new THREE.Vector3();

function pyreEllipsoidNorm(x: number, y: number, z: number) {
  const lx = x / (PYRE_RX * GALAXY_SCALE);
  const ly = y / (PYRE_RY * GALAXY_SCALE);
  const lz = z / (PYRE_RZ * GALAXY_SCALE);
  return lx * lx + ly * ly + lz * lz;
}

function isInGalaxyRegion(x: number, y: number, z: number) {
  const radial = Math.hypot(x, z);
  if (radial < GALAXY_CLEARANCE && Math.abs(y) < 28) return true;
  if (pyreEllipsoidNorm(x, y, z) < PYRE_LIMIT * PYRE_LIMIT) return true;
  return false;
}

function isVisibleFromCamera(position: [number, number, number]) {
  _projected.set(...position).project(_camera);
  return (
    _projected.z >= -1 &&
    _projected.z <= 1 &&
    Math.abs(_projected.x) <= 0.92 &&
    Math.abs(_projected.y) <= 0.92
  );
}

function tooCloseToHolders(
  position: [number, number, number],
  avoid: [number, number, number][],
) {
  const [x, y, z] = position;
  for (const [hx, hy, hz] of avoid) {
    const dx = x - hx;
    const dy = y - hy;
    const dz = z - hz;
    if (dx * dx + dy * dy + dz * dz < HOLDER_CLEARANCE * HOLDER_CLEARANCE) {
      return true;
    }
  }
  return false;
}

/**
 * Random deep-space point outside the galaxy arms and holder stars.
 */
export function pickDeepSpaceGlimmerPosition(
  avoid: [number, number, number][] = [],
): [number, number, number] | null {
  const rMin = outerHolderMinRadius();

  for (let attempt = 0; attempt < 48; attempt++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const radialT = 0.25 + Math.pow(Math.random(), 0.55) * 0.75;
    const r = rMin + radialT * (R_OUTER - rMin);

    const flatten = 0.32 + Math.random() * 0.28;
    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta) * flatten;
    const z = r * Math.cos(phi);

    const position: [number, number, number] = [x, y, z];

    if (isInGalaxyRegion(x, y, z)) continue;
    if (tooCloseToHolders(position, avoid)) continue;
    if (!isVisibleFromCamera(position)) continue;

    return position;
  }

  return null;
}
