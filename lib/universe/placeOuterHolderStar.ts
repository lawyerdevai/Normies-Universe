import type { StarPlacement } from "./generateStarPositions";
import {
  ARM_SWEEP,
  CORE_RADIUS,
  DUST_T_MAX,
  MAX_RADIUS,
} from "./galaxySpiralMath";
import { hashSeed } from "./outerSkyMath";
import { createRng, gaussian } from "./seededRandom";

const GALAXY_SCALE = 1.15;
/** Glow + perpendicular scatter beyond the outermost arm/dust radius. */
const ARM_HALO_PADDING = 14;
/** Visible gap between galaxy edge and first deep-space holder star. */
const DEEP_SPACE_CLEARANCE = 30;
const R_OUTER = 400;

function deepSpaceMinRadius(): number {
  const k = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
  const outerStructureR = CORE_RADIUS * Math.exp(k * DUST_T_MAX * ARM_SWEEP);
  return (outerStructureR + ARM_HALO_PADDING) * GALAXY_SCALE + DEEP_SPACE_CLEARANCE;
}

const R_INNER = deepSpaceMinRadius();

function hashUnit(hash: number, shift: number): number {
  return ((hash >>> shift) % 100000) / 100000;
}

function applyTangentialJitter(
  x: number,
  y: number,
  z: number,
  rng: () => number,
  scale: number,
): [number, number, number] {
  const len = Math.hypot(x, y, z) || 1;
  const nx = x / len;
  const ny = y / len;
  const nz = z / len;

  let tx = -nz;
  let ty = 0;
  let tz = nx;
  const tLen = Math.hypot(tx, ty, tz) || 1;
  tx /= tLen;
  ty /= tLen;
  tz /= tLen;

  const bx = ny * tz - nz * ty;
  const by = nz * tx - nx * tz;
  const bz = nx * ty - ny * tx;

  const j1 = gaussian(rng) * scale;
  const j2 = gaussian(rng) * scale;

  return [
    x + tx * j1 + bx * j2,
    y + ty * j1 + by * j2,
    z + tz * j1 + bz * j2,
  ];
}

/**
 * Deterministic deep-space placement from wallet hash — every holder
 * beyond rank 75 sits outside the visible galaxy, scattered across the
 * full sky from that boundary to the screen periphery.
 */
export function placeOuterHolderStar(wallet: string): StarPlacement {
  const hash = hashSeed(wallet.toLowerCase());
  const rng = createRng(hash ^ 0x9e3779b9);

  const theta =
    hashUnit(hash, 0) * Math.PI * 2 * 0.68 +
    hashUnit(hash, 11) * Math.PI * 2 * 0.32;
  const phi = Math.acos(1 - 2 * (hashUnit(hash, 5) * 0.74 + hashUnit(hash, 19) * 0.26));

  const patch =
    Math.sin(theta * 6.1 + phi * 4.7) * 0.5 +
    Math.cos(theta * 3.3 - phi * 2.1) * 0.35;
  const radialT =
    0.34 + patch * 0.2 + Math.pow(hashUnit(hash, 7), 0.78) * 0.46;
  const r = R_INNER + radialT * (R_OUTER - R_INNER);

  const flatten = 0.4 + hashUnit(hash, 13) * 0.26;
  let x = r * Math.sin(phi) * Math.cos(theta);
  let y = r * Math.sin(phi) * Math.sin(theta) * flatten;
  let z = r * Math.cos(phi);

  const jitterScale = 5 + radialT * 12;
  [x, y, z] = applyTangentialJitter(x, y, z, rng, jitterScale);

  let dist = Math.sqrt(x * x + y * y + z * z);
  if (dist < R_INNER) {
    const push = (R_INNER + hashUnit(hash, 23) * 6) / dist;
    x *= push;
    y *= push;
    z *= push;
    dist = Math.sqrt(x * x + y * y + z * z);
  }

  return {
    position: [x, y, z],
    distanceFromCenter: dist,
  };
}
