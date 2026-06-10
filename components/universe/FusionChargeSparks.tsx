"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { PYRE_RX, PYRE_RY, PYRE_RZ } from "@/lib/universe/generatePyre";

const MAX_POINTS = 12;
const MAX_ACTIVE_CHARGES = 2;
const BOUNDARY_NORM = 0.92;
const MIN_EMBER_SIZE = 0.14;

type ChargePoint = {
  active: boolean;
  position: THREE.Vector3;
  startTime: number;
  duration: number;
  flickers: number;
  size: number;
  color: [number, number, number];
};

function ellipsoidNorm(x: number, y: number, z: number) {
  return (
    (x / PYRE_RX) ** 2 + (y / PYRE_RY) ** 2 + (z / PYRE_RZ) ** 2
  );
}

function randomInside(maxNorm = 0.75): THREE.Vector3 {
  for (let i = 0; i < 32; i++) {
    const x = (Math.random() * 2 - 1) * PYRE_RX * maxNorm;
    const y = (Math.random() * 2 - 1) * PYRE_RY * maxNorm;
    const z = (Math.random() * 2 - 1) * PYRE_RZ * maxNorm;
    if (ellipsoidNorm(x, y, z) <= maxNorm * maxNorm) {
      return new THREE.Vector3(x, y, z);
    }
  }
  return new THREE.Vector3(0, 0, 0);
}

function clampInside(v: THREE.Vector3, maxNorm = BOUNDARY_NORM) {
  const n = Math.sqrt(ellipsoidNorm(v.x, v.y, v.z));
  if (n <= maxNorm) return v;
  return v.clone().multiplyScalar(maxNorm / n);
}

function chargeColor(): [number, number, number] {
  if (Math.random() < 0.45) {
    return [1, 0.97 + Math.random() * 0.03, 0.92 + Math.random() * 0.08];
  }
  return [1, 0.82 + Math.random() * 0.12, 0.58 + Math.random() * 0.18];
}

function countActiveCharges(points: ChargePoint[], now: number) {
  const chargeTimes = new Set<number>();
  for (const point of points) {
    if (point.active && now - point.startTime < point.duration) {
      chargeTimes.add(point.startTime);
    }
  }
  return chargeTimes.size;
}

function spawnCharge(points: ChargePoint[], startTime: number) {
  const center = randomInside(0.72);
  const pointCount = 4 + Math.floor(Math.random() * 3);
  const duration = 0.3 + Math.random() * 0.1;
  const flickers = 2 + Math.floor(Math.random() * 3);

  for (let i = 0; i < pointCount; i++) {
    const slot = points.findIndex((p) => !p.active);
    if (slot < 0) break;

    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.32,
      (Math.random() - 0.5) * 0.18,
      (Math.random() - 0.5) * 0.26,
    );
    const position = clampInside(center.clone().add(offset));

    points[slot] = {
      active: true,
      position,
      startTime,
      duration,
      flickers,
      size: MIN_EMBER_SIZE * (0.35 + Math.random() * 0.25),
      color: chargeColor(),
    };
  }
}

function chargeAlpha(age: number, duration: number, flickers: number) {
  if (age < 0 || age >= duration) return 0;
  const life = 1 - age / duration;
  const envelope = life * life;
  const phase = age / duration;
  const wave = Math.abs(Math.sin(phase * Math.PI * flickers));
  const sharp = wave > 0.35 ? 1 : 0.08;
  return envelope * sharp;
}

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 color;
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vAlpha = aAlpha;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 55.0);
    float halo = exp(-d * d * 14.0) * 0.12;
    float alpha = (core + halo) * vAlpha;
    if (alpha < 0.003) discard;
    vec3 lit = vColor * (core * 2.0 + halo * 0.4 + 0.12);
    gl_FragColor = vec4(lit, alpha * 0.85);
  }
`;

interface FusionChargeSparksProps {
  reducedMotion?: boolean;
}

export default function FusionChargeSparks({
  reducedMotion = false,
}: FusionChargeSparksProps) {
  const pointsRef = useRef<ChargePoint[]>(
    Array.from({ length: MAX_POINTS }, () => ({
      active: false,
      position: new THREE.Vector3(),
      startTime: -999,
      duration: 0.35,
      flickers: 3,
      size: MIN_EMBER_SIZE * 0.4,
      color: [1, 0.95, 0.85] as [number, number, number],
    })),
  );
  const schedulerRef = useRef({
    nextAt: 3 + Math.random() * 3,
  });

  const { geometry, material } = useMemo(() => {
    const positions = new Float32Array(MAX_POINTS * 3);
    const sizes = new Float32Array(MAX_POINTS);
    const alphas = new Float32Array(MAX_POINTS);
    const colors = new Float32Array(MAX_POINTS * 3);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    return { geometry, material };
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion) return;

    const t = clock.elapsedTime;
    const points = pointsRef.current;
    const scheduler = schedulerRef.current;

    if (
      countActiveCharges(points, t) < MAX_ACTIVE_CHARGES &&
      t >= scheduler.nextAt
    ) {
      spawnCharge(points, t);
      scheduler.nextAt = t + 3 + Math.random() * 3;
    }

    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    const sizeAttr = geometry.getAttribute("aSize") as THREE.BufferAttribute;
    const alphaAttr = geometry.getAttribute("aAlpha") as THREE.BufferAttribute;
    const colorAttr = geometry.getAttribute("color") as THREE.BufferAttribute;

    for (let i = 0; i < MAX_POINTS; i++) {
      const point = points[i];
      if (!point.active) {
        alphaAttr.setX(i, 0);
        continue;
      }

      const age = t - point.startTime;
      if (age >= point.duration) {
        point.active = false;
        alphaAttr.setX(i, 0);
        continue;
      }

      const alpha = chargeAlpha(age, point.duration, point.flickers);
      if (alpha <= 0.003) {
        alphaAttr.setX(i, 0);
        continue;
      }

      posAttr.setXYZ(i, point.position.x, point.position.y, point.position.z);
      sizeAttr.setX(i, point.size);
      colorAttr.setXYZ(i, ...point.color);
      alphaAttr.setX(i, alpha);
    }

    posAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    alphaAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
  });

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={19}
      raycast={() => null}
    />
  );
}
