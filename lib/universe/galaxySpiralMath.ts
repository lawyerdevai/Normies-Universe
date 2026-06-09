import { createRng, gaussian } from "./seededRandom";

export const ARM_SWEEP = Math.PI * 3;
export const CORE_RADIUS = 14;
export const MAX_RADIUS = 95;
export const SPIRAL_K = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;
/** Gap between The Pyre and inner arm holders (reserved for 50+ whales). */
export const WHALE_GAP_RADIUS = 30;

export function hashAddress(address: string) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function radiusAtArmT(t: number) {
  return CORE_RADIUS * Math.exp(SPIRAL_K * t * ARM_SWEEP);
}

export function armTForMinRadius(minR: number) {
  return Math.log(minR / CORE_RADIUS) / (SPIRAL_K * ARM_SWEEP);
}

export const INNER_ARM_T_MIN = armTForMinRadius(WHALE_GAP_RADIUS);
export const INNER_ARM_T_MAX = 0.52;
export const OUTER_ARM_T_MIN = 0.42;
export const OUTER_ARM_T_MAX = 0.86;
export const DUST_T_MIN = 0.74;
export const DUST_T_MAX = 1.02;

export function coreBulgeColor(
  density: number,
  rng: () => number,
): [number, number, number] {
  const warm = 0.4 + density * 0.6;
  let r = 0.84 + warm * 0.08;
  let g = 0.78 + warm * 0.06;
  let b = 0.66 + warm * 0.03;

  const accent = rng();
  if (accent > 0.88) {
    r += 0.04;
    g -= 0.015;
    b += 0.03;
  } else if (accent > 0.94) {
    r -= 0.025;
    g += 0.01;
    b += 0.045;
  } else if (accent > 0.985) {
    r -= 0.02;
    g += 0.02;
    b += 0.055;
  }

  return [
    r + (rng() - 0.5) * 0.02,
    g + (rng() - 0.5) * 0.018,
    b + (rng() - 0.5) * 0.02,
  ];
}

export function armColor(
  t: number,
  arm: number,
  coreProx: number,
  rng: () => number,
): [number, number, number] {
  let r = 0.76;
  let g = 0.79;
  let b = 0.84;

  if (t < 0.24) {
    const warm = 1 - t / 0.24;
    r += warm * 0.1;
    g += warm * 0.04;
    b -= warm * 0.07;
  }

  const pinkWave = Math.sin(t * 4.8 + arm * 1.1) * 0.5 + 0.5;
  if (coreProx > 0.45 && t > 0.12 && t < 0.58 && pinkWave > 0.74) {
    r += 0.05;
    g -= 0.015;
    b += 0.035;
  }

  const violetWave = Math.cos(t * 3.2 + arm * 0.75) * 0.5 + 0.5;
  if (t > 0.2 && violetWave > 0.7) {
    r -= 0.035;
    g += 0.01;
    b += 0.06;
  }

  return [
    r + (rng() - 0.5) * 0.018,
    g + (rng() - 0.5) * 0.015,
    b + (rng() - 0.5) * 0.018,
  ];
}

export function dustColor(rng: () => number): [number, number, number] {
  return [
    0.68 + (rng() - 0.5) * 0.04,
    0.72 + (rng() - 0.5) * 0.035,
    0.8 + (rng() - 0.5) * 0.04,
  ];
}

export function spiralArmPosition(
  arm: number,
  t: number,
  rng: () => number,
  scatterScale = 1,
): { position: [number, number, number]; coreProx: number } {
  const startAngle = arm * Math.PI;
  const theta = startAngle + t * ARM_SWEEP;
  const r = CORE_RADIUS * Math.exp(SPIRAL_K * (theta - startAngle));
  const armWidth = (2 + (1 - t) * 5) * Math.exp(-r / 80);
  const perp = theta + Math.PI / 2;
  const scatter = gaussian(rng) * armWidth * scatterScale;

  const x = r * Math.cos(theta) + Math.cos(perp) * scatter;
  const z = r * Math.sin(theta) + Math.sin(perp) * scatter;
  const y = gaussian(rng) * (1.5 + (1 - t) * 2);
  const coreProx = Math.exp(-t * 2.5);

  return { position: [x, y, z], coreProx };
}

export function localRadius(x: number, z: number) {
  return Math.sqrt(x * x + z * z);
}
