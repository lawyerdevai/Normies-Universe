"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createRng } from "@/lib/universe/seededRandom";

const LAYERS = [
  { count: 9000, seed: 88001, size: [0.09, 0.32] as [number, number], brightness: [0.05, 0.16] as [number, number], spread: 1.4 },
  { count: 2800, seed: 88002, size: [0.22, 0.6] as [number, number], brightness: [0.12, 0.32] as [number, number], spread: 1.0 },
  { count: 900, seed: 88003, size: [0.5, 1.2] as [number, number], brightness: [0.24, 0.64] as [number, number], spread: 0.65 },
];

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute vec3 color;
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vBrightness = aBrightness;
    vColor = color;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (220.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uShowHalo;
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 32.0);
    float halo = exp(-d * d * 7.0) * 0.25 * uShowHalo;
    float alpha = (core + halo) * vBrightness;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vColor * (core + halo * 0.3), alpha);
  }
`;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

type TwinkleMeta = {
  baseBrightness: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  enabled: Uint8Array;
};

export type BackgroundStarsDebugLayers = {
  enabled: boolean;
  particleHalo: boolean;
};

interface BackgroundStarsProps {
  debugLayers?: BackgroundStarsDebugLayers;
}

export default function BackgroundStars({ debugLayers }: BackgroundStarsProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const twinkleRef = useRef<TwinkleMeta | null>(null);
  const enabled = debugLayers?.enabled ?? true;
  const showHalo = debugLayers?.particleHalo ?? true;

  const { geometry, material } = useMemo(() => {
    const total = LAYERS.reduce((s, l) => s + l.count, 0);
    const positions = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const brightness = new Float32Array(total);
    const colors = new Float32Array(total * 3);
    const baseBrightness = new Float32Array(total);
    const phases = new Float32Array(total);
    const speeds = new Float32Array(total);
    const twinkleEnabled = new Uint8Array(total);

    let offset = 0;
    for (const layer of LAYERS) {
      const rng = createRng(layer.seed);
      for (let i = 0; i < layer.count; i++) {
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        const r = (90 + rng() * 280) * layer.spread;
        const idx = offset + i;
        positions[idx * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
        positions[idx * 3 + 2] = r * Math.cos(phi);
        sizes[idx] = lerp(layer.size[0], layer.size[1], rng());
        const bright = lerp(layer.brightness[0], layer.brightness[1], rng());
        brightness[idx] = bright;
        baseBrightness[idx] = bright;

        if (rng() < 0.08) {
          twinkleEnabled[idx] = 1;
          phases[idx] = rng() * Math.PI * 2;
          const period = 2 + rng();
          speeds[idx] = (Math.PI * 2) / period;
        }

        const tint = rng();
        let cr = 0.76 + tint * 0.06;
        let cg = 0.78 + tint * 0.05;
        let cb = 0.82 + tint * 0.07;
        if (tint > 0.78) {
          cb += 0.05;
          cg += 0.015;
          cr -= 0.015;
        }
        colors[idx * 3] = cr;
        colors[idx * 3 + 1] = cg;
        colors[idx * 3 + 2] = cb;
      }
      offset += layer.count;
    }

    twinkleRef.current = {
      baseBrightness,
      phases,
      speeds,
      enabled: twinkleEnabled,
    };

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: { uShowHalo: { value: showHalo ? 1 : 0 } },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry, material };
  }, [showHalo]);

  useLayoutEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.raycast = () => {};
    }
  });

  useFrame(({ clock }) => {
    const meta = twinkleRef.current;
    const attr = geometry.getAttribute("aBrightness") as THREE.BufferAttribute;
    if (!meta || !attr) return;

    const t = clock.elapsedTime;
    const { baseBrightness, phases, speeds, enabled: twinkleOn } = meta;
    let dirty = false;

    for (let i = 0; i < baseBrightness.length; i++) {
      if (!twinkleOn[i]) continue;
      const wave = Math.sin(t * speeds[i] + phases[i]);
      const lift = Math.max(0, wave);
      const next = baseBrightness[i] * (1.0 + lift * 0.25);
      if (attr.getX(i) !== next) {
        attr.setX(i, next);
        dirty = true;
      }
    }

    if (dirty) attr.needsUpdate = true;
  });

  if (!enabled) return null;

  return (
    <points
      ref={pointsRef}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
