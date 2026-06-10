import { createRng } from "./seededRandom";

/** Reroll arm clumps, gaps, spurs, and asymmetry by changing this seed. */
export const ARM_NOISE_SEED = 1;

const DENSITY_BINS = 80;
const TAIL_START = 0.85;

/** Sharper drop in the outer 15% — arm ends with presence, not a whisper. */
function armTailDensity(t: number): number {
  if (t <= TAIL_START) return 1;
  const u = (t - TAIL_START) / (1 - TAIL_START);
  const falloff = u * u * u;
  return Math.max(0, 1 - falloff);
}

export type ArmClump = {
  center: number;
  width: number;
};

export type ArmGap = {
  center: number;
  width: number;
};

export type ArmSpur = {
  startT: number;
  side: number;
  lengthT: number;
};

export type ArmImperfectionProfile = {
  /** Arm 0 = arm 1 in user terms — 20% denser than arm index 1. */
  densityMult: number;
  clumps: ArmClump[];
  gaps: ArmGap[];
  spurs: ArmSpur[];
};

function gaussianBump(t: number, center: number, width: number): number {
  const d = (t - center) / Math.max(width, 0.02);
  return Math.exp(-d * d * 0.5);
}

/** Local linear density — 2× in clumps, 0.3× in gaps (multiplicative). */
export function armDensityAtT(t: number, profile: ArmImperfectionProfile): number {
  let w = profile.densityMult;

  for (const c of profile.clumps) {
    const bump = gaussianBump(t, c.center, c.width);
    w *= 1 + bump;
  }

  for (const g of profile.gaps) {
    const bump = gaussianBump(t, g.center, g.width);
    w *= 1 - 0.7 * bump;
  }

  return Math.max(0.05, w * armTailDensity(t));
}

export function clumpTightness(t: number, profile: ArmImperfectionProfile): number {
  let bump = 0;
  for (const c of profile.clumps) {
    bump = Math.max(bump, gaussianBump(t, c.center, c.width));
  }
  return 1 - 0.38 * bump;
}

function placeFeatures(
  count: number,
  rng: () => number,
  tMin: number,
  tMax: number,
  minSep: number,
): number[] {
  const centers: number[] = [];
  let guard = 0;
  while (centers.length < count && guard++ < count * 40) {
    const c = tMin + rng() * (tMax - tMin);
    if (centers.every((x) => Math.abs(x - c) > minSep)) {
      centers.push(c);
    }
  }
  while (centers.length < count) {
    centers.push(tMin + rng() * (tMax - tMin));
  }
  return centers;
}

function buildProfile(arm: number, rng: () => number): ArmImperfectionProfile {
  const clumpCount = 4 + Math.floor(rng() * 2);
  const clumpCenters = placeFeatures(clumpCount, rng, 0.1, 0.88, 0.1);
  const clumps: ArmClump[] = clumpCenters.map((center) => ({
    center,
    width: 0.08 + rng() * 0.04,
  }));

  const gapCount = 3 + Math.floor(rng() * 2);
  const gapCenters = placeFeatures(gapCount, rng, 0.14, 0.9, 0.11);
  const gaps: ArmGap[] = gapCenters.map((center) => ({
    center,
    width: 0.08 + rng() * 0.04,
  }));

  const spurs: ArmSpur[] = [
    {
      startT: 0.2 + rng() * 0.28,
      side: -1,
      lengthT: 0.15 + rng() * 0.05,
    },
    {
      startT: 0.45 + rng() * 0.35,
      side: 1,
      lengthT: 0.15 + rng() * 0.05,
    },
  ];

  return {
    densityMult: arm === 0 ? 1.2 : 1.0,
    clumps,
    gaps,
    spurs,
  };
}

export function buildArmImperfectionProfiles(
  seed = ARM_NOISE_SEED,
): [ArmImperfectionProfile, ArmImperfectionProfile] {
  const rng = createRng(seed ^ 0xa17d4e);
  return [buildProfile(0, rng), buildProfile(1, rng)];
}

export type ArmTSampler = (rng: () => number) => number;

/**
 * Maps ARM_NOISE_SEED density field → t along the arm.
 * Particle counts per stretch follow these weights (not uniform t).
 */
export function createArmTSampler(
  profile: ArmImperfectionProfile,
): ArmTSampler {
  const weights = new Float64Array(DENSITY_BINS);
  let total = 0;
  for (let i = 0; i < DENSITY_BINS; i++) {
    const t = (i + 0.5) / DENSITY_BINS;
    const w = armDensityAtT(t, profile);
    weights[i] = w;
    total += w;
  }

  const cdf = new Float64Array(DENSITY_BINS);
  let run = 0;
  for (let i = 0; i < DENSITY_BINS; i++) {
    run += weights[i];
    cdf[i] = run;
  }

  return (rng: () => number) => {
    const target = rng() * total;
    let lo = 0;
    let hi = DENSITY_BINS - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cdf[mid] < target) lo = mid + 1;
      else hi = mid;
    }
    return (lo + rng()) / DENSITY_BINS;
  };
}
