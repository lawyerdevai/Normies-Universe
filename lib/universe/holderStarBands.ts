import * as THREE from "three";
import { PYRE_RX } from "./generatePyre";

/** Ellipsoid surface multiplier — clears visible Pyre glow + buffer. */
export const PYRE_EXCLUSION_MARGIN = 1.34;

const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;
const SPIRAL_K = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_EULER_INV = new THREE.Euler(-0.28, -0.15, -0.35, "XYZ");
const GALAXY_SCALE = 1.15;

const _v = new THREE.Vector3();

export type RankRing = {
  tMin: number;
  tMax: number;
  count: number;
  index0: number;
  rankLo: number;
  rankHi: number;
};

export const HOLDER_STAR_BANDS: RankRing[] = [
  { tMin: 0.055, tMax: 0.165, count: 5, index0: 1, rankLo: 1, rankHi: 5 },
  { tMin: 0.167, tMax: 0.275, count: 10, index0: 6, rankLo: 6, rankHi: 15 },
  { tMin: 0.277, tMax: 0.405, count: 15, index0: 16, rankLo: 16, rankHi: 30 },
  { tMin: 0.407, tMax: 0.615, count: 20, index0: 31, rankLo: 31, rankHi: 50 },
  { tMin: 0.617, tMax: 0.93, count: 25, index0: 51, rankLo: 51, rankHi: 75 },
];

export function ringForRank(rank: number): RankRing {
  return (
    HOLDER_STAR_BANDS.find((b) => rank >= b.rankLo && rank <= b.rankHi) ??
    HOLDER_STAR_BANDS[HOLDER_STAR_BANDS.length - 1]
  );
}

function spiralR(armT: number) {
  return CORE_RADIUS * Math.exp(SPIRAL_K * armT * ARM_SWEEP);
}

function worldDistanceAtLocal(lx: number, ly: number, lz: number) {
  _v.set(lx * GALAXY_SCALE, ly * GALAXY_SCALE, lz * GALAXY_SCALE);
  _v.applyEuler(GALAXY_EULER);
  return _v.length();
}

export type BandWorldBounds = { min: number; max: number };

/** World-space distance bounds per band from spiral t ranges. */
export function bandWorldBounds(ring: RankRing): BandWorldBounds {
  const rMin = spiralR(ring.tMin);
  const rMax = spiralR(ring.tMax);
  const min = worldDistanceAtLocal(rMin, 0, 0);
  const max = worldDistanceAtLocal(rMax, 5.5, rMax * 0.22);
  return { min, max };
}

const BAND_WORLD_BOUNDS = HOLDER_STAR_BANDS.map(bandWorldBounds);

/** Minimum world radial distance that clears the Pyre exclusion ellipsoid. */
export function pyreExclusionWorldMin(): number {
  return localToWorldPlacement(
    PYRE_RX * PYRE_EXCLUSION_MARGIN,
    0,
    0,
  ).distanceFromCenter;
}

/**
 * Non-overlapping world radial slices — outer band mins sit past inner band maxes
 * so rank ordering by distance is always preserved after clamping.
 */
function computeStrictBandBounds(): BandWorldBounds[] {
  const GAP = 0.08;
  const raw = BAND_WORLD_BOUNDS;
  const outerMax = raw[raw.length - 1].max;
  const start = Math.max(raw[0].min, pyreExclusionWorldMin());
  const widths = raw.map((r) => r.max - r.min);
  const totalGaps = GAP * (raw.length - 1);
  const available = outerMax - start - totalGaps;
  const scale = available / widths.reduce((a, b) => a + b, 0);

  let cursor = start;
  return widths.map((w) => {
    const min = cursor;
    const max = min + w * scale;
    cursor = max + GAP;
    return { min, max };
  });
}

const STRICT_BAND_WORLD_BOUNDS = computeStrictBandBounds();

export function worldBoundsForRank(rank: number): BandWorldBounds {
  const idx = HOLDER_STAR_BANDS.findIndex(
    (b) => rank >= b.rankLo && rank <= b.rankHi,
  );
  return STRICT_BAND_WORLD_BOUNDS[
    idx >= 0 ? idx : STRICT_BAND_WORLD_BOUNDS.length - 1
  ];
}

export function worldToLocal(
  wx: number,
  wy: number,
  wz: number,
): [number, number, number] {
  _v.set(wx, wy, wz);
  _v.applyEuler(GALAXY_EULER_INV);
  _v.divideScalar(GALAXY_SCALE);
  return [_v.x, _v.y, _v.z];
}

export function localToWorldPlacement(
  lx: number,
  ly: number,
  lz: number,
): { position: [number, number, number]; distanceFromCenter: number } {
  _v.set(lx * GALAXY_SCALE, ly * GALAXY_SCALE, lz * GALAXY_SCALE);
  _v.applyEuler(GALAXY_EULER);
  return {
    position: [_v.x, _v.y, _v.z],
    distanceFromCenter: _v.length(),
  };
}

export function scaleWorldRadial(
  position: [number, number, number],
  targetDist: number,
): { position: [number, number, number]; distanceFromCenter: number } {
  const [x, y, z] = position;
  const dist = Math.sqrt(x * x + y * y + z * z);
  if (dist < 1e-6) {
    return { position: [targetDist, 0, 0], distanceFromCenter: targetDist };
  }
  const s = targetDist / dist;
  return {
    position: [x * s, y * s, z * s],
    distanceFromCenter: targetDist,
  };
}
