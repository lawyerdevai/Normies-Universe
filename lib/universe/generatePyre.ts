import { clamp01, createRng, lerp } from "./seededRandom";

export const PYRE_COUNT = 1839;
/** Hard cap — live burned total maps 1:1 up to this count. */
export const PYRE_PARTICLE_CAP = 4000;

export function pyreParticleCount(totalBurned: number): number {
  const n = Math.round(totalBurned);
  if (!Number.isFinite(n) || n < 1) return PYRE_COUNT;
  return Math.min(n, PYRE_PARTICLE_CAP);
}
/** Ellipsoid radii — fills the inner galactic core disc. */
export const PYRE_RX = 11;
export const PYRE_RY = 3.4;
export const PYRE_RZ = 8.2;
export const PYRE_MAX_SIZE = 2.4;

export type PyreParticle = {
  position: [number, number, number];
  size: number;
  baseBrightness: number;
  color: [number, number, number];
  phase: number;
  flickerSpeed: number;
};

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [r + m, g + m, b + m];
}

function emberColor(rng: () => number, distT: number): [number, number, number] {
  const roll = rng();

  if (roll < 0.07) {
    return hslToRgb(48 + rng() * 8, 0.18 + rng() * 0.22, 0.9 + rng() * 0.08);
  }
  if (roll < 0.12) {
    return hslToRgb(38 + rng() * 6, 0.42 + rng() * 0.22, 0.8 + rng() * 0.12);
  }
  if (roll < 0.3) {
    return hslToRgb(8 + rng() * 10, 0.8 + rng() * 0.14, lerp(0.36, 0.52, 1 - distT));
  }
  if (roll < 0.54) {
    return hslToRgb(18 + rng() * 12, 0.76 + rng() * 0.16, lerp(0.4, 0.58, 1 - distT * 0.9));
  }
  if (roll < 0.78) {
    return hslToRgb(28 + rng() * 14, 0.68 + rng() * 0.2, lerp(0.44, 0.65, 1 - distT * 0.8));
  }
  return hslToRgb(42 + rng() * 10, 0.52 + rng() * 0.24, lerp(0.52, 0.74, 1 - distT * 0.7));
}

function pyrePosition(rng: () => number): {
  position: [number, number, number];
  distT: number;
} {
  const theta = rng() * Math.PI * 2;
  const mode = rng();

  let radial: number;
  if (mode < 0.45) {
    radial = 0.35 + rng() * 0.65;
  } else if (mode < 0.75) {
    radial = Math.pow(rng(), 0.55);
  } else {
    radial = 0.12 + Math.pow(rng(), 0.72) * 0.88;
  }

  const rx = PYRE_RX * radial * (0.92 + rng() * 0.12);
  const rz = PYRE_RZ * radial * (0.92 + rng() * 0.12);
  const ry = PYRE_RY * (0.55 + rng() * 0.45) * (1 - radial * 0.25);

  const x = rx * Math.cos(theta) + (rng() - 0.5) * 0.8;
  const z = rz * Math.sin(theta) + (rng() - 0.5) * 0.8;
  const y = (rng() - 0.5) * 2 * ry;

  const norm =
    (x / PYRE_RX) * (x / PYRE_RX) +
    (y / PYRE_RY) * (y / PYRE_RY) +
    (z / PYRE_RZ) * (z / PYRE_RZ);
  const distT = clamp01(Math.sqrt(norm));

  return { position: [x, y, z], distT };
}

function pyreSize(rng: () => number, distT: number) {
  const roll = rng();
  let size: number;

  if (roll < 0.4) {
    size = 0.14 + rng() * 0.38;
  } else if (roll < 0.78) {
    size = 0.45 + rng() * 0.85;
  } else {
    size = 1.05 + rng() * 1.05;
  }

  size *= lerp(0.95, 1.12, 1 - distT * 0.6);
  return Math.min(size, PYRE_MAX_SIZE);
}

export function generatePyreParticles(count = PYRE_COUNT): PyreParticle[] {
  const rng = createRng(18390427);
  const particles: PyreParticle[] = [];

  for (let i = 0; i < count; i++) {
    const { position, distT } = pyrePosition(rng);
    const color = emberColor(rng, distT);
    const size = pyreSize(rng, distT);
    const centerLift = lerp(0.72, 1, Math.pow(1 - distT, 0.35));
    const baseBrightness = lerp(0.42, 1.05, rng()) * centerLift;

    const period = 1 + rng() * 3;
    const flickerSpeed = (Math.PI * 2) / period;

    particles.push({
      position,
      size,
      baseBrightness,
      color,
      phase: rng() * Math.PI * 2,
      flickerSpeed,
    });
  }

  return particles;
}
