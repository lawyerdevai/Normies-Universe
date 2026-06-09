import { clamp01, createRng, lerp } from "./seededRandom";

export const PYRE_COUNT = 1839;
export const PYRE_RADIUS = 5.2;

export type PyreParticle = {
  position: [number, number, number];
  size: number;
  baseBrightness: number;
  color: [number, number, number];
  phase: number;
  flickerSpeed: number;
  flarePhase: number;
  flareStrength: number;
};

function emberColor(
  rng: () => number,
  distT: number,
  hot: boolean,
): [number, number, number] {
  if (hot) {
    const h = 42 + rng() * 10;
    const s = 0.55 + rng() * 0.25;
    const l = 0.72 + rng() * 0.18;
    return hslToRgb(h, s, l);
  }

  const roll = rng();
  let h: number;
  let s: number;
  let l: number;

  if (roll < 0.35) {
    h = 14 + rng() * 8;
    s = 0.82 + rng() * 0.12;
    l = lerp(0.38, 0.52, 1 - distT);
  } else if (roll < 0.7) {
    h = 24 + rng() * 14;
    s = 0.78 + rng() * 0.15;
    l = lerp(0.45, 0.62, 1 - distT * 0.85);
  } else {
    h = 8 + rng() * 10;
    s = 0.85 + rng() * 0.1;
    l = lerp(0.34, 0.48, 1 - distT);
  }

  return hslToRgb(h, s, l);
}

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

export function generatePyreParticles(count = PYRE_COUNT): PyreParticle[] {
  const rng = createRng(18390427);
  const particles: PyreParticle[] = [];

  for (let i = 0; i < count; i++) {
    const u = rng();
    const r = PYRE_RADIUS * Math.pow(u, 0.38);
    const distT = clamp01(r / PYRE_RADIUS);

    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const sinPhi = Math.sin(phi);

    const x = r * sinPhi * Math.cos(theta);
    const y = r * sinPhi * Math.sin(theta) * 0.82;
    const z = r * Math.cos(phi) * 0.88;

    const hot = rng() < 0.065 && distT < 0.55;
    const color = emberColor(rng, distT, hot);

    const centerBoost = 1 - distT;
    const size = lerp(0.65, 2.1, Math.pow(centerBoost, 0.7)) * (hot ? 1.35 : 1);
    const baseBrightness = lerp(0.55, 1.45, Math.pow(centerBoost, 0.55)) * (hot ? 1.25 : 1);

    particles.push({
      position: [x, y, z],
      size,
      baseBrightness,
      color,
      phase: rng() * Math.PI * 2,
      flickerSpeed: 0.25 + rng() * 0.95,
      flarePhase: rng() * Math.PI * 2,
      flareStrength: 0.15 + rng() * 0.55,
    });
  }

  return particles;
}
