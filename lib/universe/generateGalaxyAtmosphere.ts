import { createRng, gaussian } from "./seededRandom";

export type AtmosphereParticle = {
  position: [number, number, number];
  size: number;
  brightness: number;
  color: [number, number, number];
  isCore: boolean;
};

function coreBulgeColor(density: number, rng: () => number): [number, number, number] {
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

  // Dense elliptical galactic bulge — many tiny particles, organic cloud
  const bulgeTarget = Math.floor(count * 0.22);
  let bulgeAdded = 0;
  let bulgeAttempts = 0;
  while (bulgeAdded < bulgeTarget && bulgeAttempts < bulgeTarget * 5) {
    bulgeAttempts++;
    const theta = rng() * Math.PI * 2;
    const radial = Math.pow(rng(), 0.58);
    const rx = 11.5;
    const ry = 2.6;
    const rz = 7.2;

    const x =
      radial * rx * Math.cos(theta) +
      gaussian(rng) * (1.4 + radial * 1.8);
    const y = gaussian(rng) * (ry * (0.35 + radial * 0.65));
    const z =
      radial * rz * Math.sin(theta) * 0.55 +
      gaussian(rng) * (1.1 + radial * 1.2);
    const warp = Math.sin(theta * 2.4) * 0.5 * (1 - radial);

    const norm =
      (x / rx) * (x / rx) +
      (y / ry) * (y / ry) +
      (z / rz) * (z / rz);
    const density = Math.exp(-norm * 1.35);
    if (density < 0.05) continue;

    particles.push({
      position: [x + warp, y, z],
      size: 0.1 + density * 0.42 + rng() * 0.1,
      brightness: (0.05 + density * 0.18) * (0.72 + rng() * 0.28),
      color: coreBulgeColor(density, rng),
      isCore: true,
    });
    bulgeAdded++;
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
        isCore: false,
      });
    }
  }

  return particles;
}
