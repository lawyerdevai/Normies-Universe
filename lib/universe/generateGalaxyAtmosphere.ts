import { createRng, gaussian } from "./seededRandom";

export type AtmosphereParticle = {
  position: [number, number, number];
  size: number;
  brightness: number;
  color: [number, number, number];
};

function coreBarColor(bulge: number, rng: () => number): [number, number, number] {
  const warm = 0.55 + bulge * 0.45;
  return [
    0.84 + warm * 0.1 + rng() * 0.02,
    0.8 + warm * 0.05 + rng() * 0.015,
    0.7 + warm * 0.02 + rng() * 0.015,
  ];
}

function armColor(
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

const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;

export function generateGalaxyAtmosphere(count = 14000): AtmosphereParticle[] {
  const rng = createRng(33107);
  const particles: AtmosphereParticle[] = [];
  const k = Math.log(MAX_RADIUS / CORE_RADIUS) / ARM_SWEEP;

  // Elongated luminous bar at center
  for (let i = 0; i < Math.floor(count * 0.18); i++) {
    const along = (rng() - 0.5) * 22;
    const across = gaussian(rng) * 5;
    const depth = gaussian(rng) * 3;
    const bulge = Math.exp(-(across * across + depth * depth) / 30);
    particles.push({
      position: [along, depth, across * 0.4],
      size: 0.5 + bulge * 2.2 + rng() * 0.8,
      brightness: (0.25 + bulge * 0.55) * (0.7 + rng() * 0.3),
      color: coreBarColor(bulge, rng),
    });
  }

  // Two spiral arms — monochromatic cloud clusters
  const perArm = Math.floor((count * 0.82) / 2);
  for (let arm = 0; arm < 2; arm++) {
    const startAngle = arm * Math.PI;
    for (let i = 0; i < perArm; i++) {
      const t = i / perArm;
      const theta = startAngle + t * ARM_SWEEP;
      const r = CORE_RADIUS * Math.exp(k * (theta - startAngle));
      const armWidth = (2 + (1 - t) * 5) * Math.exp(-r / 80);
      const perp = theta + Math.PI / 2;
      const scatter = gaussian(rng) * armWidth;

      const x = r * Math.cos(theta) + Math.cos(perp) * scatter;
      const z = r * Math.sin(theta) + Math.sin(perp) * scatter;
      const y = gaussian(rng) * (1.5 + (1 - t) * 2);
      const coreProx = Math.exp(-t * 2.5);

      particles.push({
        position: [x, y, z],
        size: 0.3 + coreProx * 1.4 + (1 - t) * 0.5 + rng() * 0.4,
        brightness: (0.08 + coreProx * 0.35 + (1 - t) * 0.12) * (0.6 + rng() * 0.4),
        color: armColor(t, arm, coreProx, rng),
      });
    }
  }

  return particles;
}
