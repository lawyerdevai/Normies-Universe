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

function smoothstep01(value: number) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

/** Smooth radial gradient: warm core → silver mid → cool blue outer tips. */
function armColorByRadius(
  radius: number,
  rng: () => number,
): [number, number, number] {
  const radialT = Math.min(
    1,
    Math.max(0, (radius - CORE_RADIUS) / (MAX_RADIUS - CORE_RADIUS)),
  );

  const warm: [number, number, number] = [0.97, 0.9, 0.74];
  const mid: [number, number, number] = [0.95, 0.96, 0.98];
  const cool: [number, number, number] = [0.8, 0.88, 1.0];

  let r: number;
  let g: number;
  let b: number;

  if (radialT < 0.4) {
    const s = smoothstep01(radialT / 0.4);
    r = warm[0] + (mid[0] - warm[0]) * s;
    g = warm[1] + (mid[1] - warm[1]) * s;
    b = warm[2] + (mid[2] - warm[2]) * s;
  } else {
    const s = smoothstep01((radialT - 0.4) / 0.6);
    r = mid[0] + (cool[0] - mid[0]) * s;
    g = mid[1] + (cool[1] - mid[1]) * s;
    b = mid[2] + (cool[2] - mid[2]) * s;
  }

  return [
    r + (rng() - 0.5) * 0.014,
    g + (rng() - 0.5) * 0.012,
    b + (rng() - 0.5) * 0.014,
  ];
}

const ARM_SWEEP = Math.PI * 3;
const CORE_RADIUS = 14;
const MAX_RADIUS = 95;

/** Inner core 0.75×, mid 1.0×, outer arms/tips 1.3× — smooth, no banding. */
function radialBrightnessWeight(x: number, z: number): number {
  const t = Math.min(1, Math.max(0, Math.hypot(x, z) / MAX_RADIUS));
  const innerEdge = 1 / 3;
  const outerEdge = 2 / 3;

  if (t < innerEdge) {
    return 0.75 + smoothstep01(t / innerEdge) * 0.25;
  }
  if (t > outerEdge) {
    return 1.0 + smoothstep01((t - outerEdge) / (1 - outerEdge)) * 0.3;
  }
  return 1.0;
}

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

    const bx = x + warp;
    particles.push({
      position: [bx, y, z],
      size: 0.1 + density * 0.42 + rng() * 0.1,
      brightness:
        (0.05 + density * 0.18) *
        (0.72 + rng() * 0.28) *
        radialBrightnessWeight(bx, z),
      color: coreBulgeColor(density, rng),
      isCore: true,
    });
    bulgeAdded++;
  }

  // Two spiral arms — monochromatic cloud clusters
  const perArm = Math.floor(((count * 0.82) / 2) * 2.1);
  for (let arm = 0; arm < 2; arm++) {
    const startAngle = arm * Math.PI;
    for (let i = 0; i < perArm; i++) {
      const t = i / perArm;
      const theta = startAngle + t * ARM_SWEEP;
      const r = CORE_RADIUS * Math.exp(k * (theta - startAngle));
      const armWidth = (2 + (1 - t) * 5) * Math.exp(-r / 80);
      const perp = theta + Math.PI / 2;
      const scatter = gaussian(rng) * armWidth;
      const spineDist = Math.abs(scatter) / armWidth;
      const spineWeight = Math.exp(-spineDist * spineDist * 2.1);

      const x = r * Math.cos(theta) + Math.cos(perp) * scatter;
      const z = r * Math.sin(theta) + Math.sin(perp) * scatter;
      const y = gaussian(rng) * (1.5 + (1 - t) * 2);
      const coreProx = Math.exp(-t * 2.5);

      const baseBright =
        (0.08 + coreProx * 0.35 + (1 - t) * 0.12) * (0.6 + rng() * 0.4);

      particles.push({
        position: [x, y, z],
        size: 0.3 + coreProx * 1.4 + (1 - t) * 0.5 + rng() * 0.4,
        brightness:
          baseBright *
          (0.6 + spineWeight * 0.7) *
          3.0 *
          radialBrightnessWeight(x, z),
        color: armColorByRadius(r, rng),
        isCore: false,
      });
    }
  }

  return particles;
}
