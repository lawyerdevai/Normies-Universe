"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { createRng } from "@/lib/universe/seededRandom";

/** Three-layer deep-space field (same approach as Starform ViewportBleedStars). */
const SHELL_RADIUS_MIN = 150;
const SHELL_RADIUS_MAX = 300;

const BRIGHTNESS_FLOOR = 0.05;

const LAYERS = [
  {
    count: 8000,
    seed: 88001,
    size: [0.315, 0.7875] as [number, number],
    brightness: [0.08, 0.22] as [number, number],
    twinkleRate: 0,
  },
  {
    count: 2000,
    seed: 88002,
    size: [0.54, 1.35] as [number, number],
    brightness: [0.22, 0.42] as [number, number],
    twinkleRate: 0.25,
    twinkleLift: 0.8,
    twinkleCycle: [1.5, 4] as [number, number],
  },
  {
    count: 150,
    seed: 88003,
    size: [0.9, 1.9125] as [number, number],
    brightness: [0.42, 0.72] as [number, number],
    twinkleRate: 0.25,
    twinkleLift: 0.8,
    twinkleCycle: [1.5, 4] as [number, number],
  },
];

const COLOR_COOL = new THREE.Color("#E8F4FF");
const COLOR_WHITE = new THREE.Color("#FFFFFF");

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

function cycleSpeed(cycleMin: number, cycleMax: number, rng: () => number) {
  return (Math.PI * 2) / (cycleMin + rng() * (cycleMax - cycleMin));
}

type TwinkleMeta = {
  baseBrightness: Float32Array;
  phases: Float32Array;
  speeds: Float32Array;
  lifts: Float32Array;
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
    const lifts = new Float32Array(total);
    const twinkleEnabled = new Uint8Array(total);

    let offset = 0;
    for (const layer of LAYERS) {
      const rng = createRng(layer.seed);
      for (let i = 0; i < layer.count; i++) {
        const theta = rng() * Math.PI * 2;
        const phi = Math.acos(2 * rng() - 1);
        const r =
          SHELL_RADIUS_MIN +
          rng() * (SHELL_RADIUS_MAX - SHELL_RADIUS_MIN);
        const idx = offset + i;
        positions[idx * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.3;
        positions[idx * 3 + 2] = r * Math.cos(phi);
        sizes[idx] = lerp(layer.size[0], layer.size[1], rng());
        const bright = Math.min(
          layer.brightness[1],
          lerp(layer.brightness[0], layer.brightness[1], rng()) +
            BRIGHTNESS_FLOOR,
        );
        brightness[idx] = bright;
        baseBrightness[idx] = bright;

        if (
          layer.twinkleRate > 0 &&
          rng() < layer.twinkleRate &&
          "twinkleLift" in layer
        ) {
          twinkleEnabled[idx] = 1;
          phases[idx] = rng() * Math.PI * 2;
          speeds[idx] = cycleSpeed(
            layer.twinkleCycle[0],
            layer.twinkleCycle[1],
            rng,
          );
          lifts[idx] = layer.twinkleLift;
        }

        const color = COLOR_COOL.clone().lerp(COLOR_WHITE, bright * 0.35);
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;
      }
      offset += layer.count;
    }

    twinkleRef.current = {
      baseBrightness,
      phases,
      speeds,
      lifts,
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

    geometry.computeBoundingSphere();

    return { geometry, material };
  }, [showHalo]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

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
    const { baseBrightness, phases, speeds, lifts, enabled: twinkleOn } = meta;
    let dirty = false;

    for (let i = 0; i < baseBrightness.length; i++) {
      if (!twinkleOn[i]) continue;
      const wave = Math.sin(t * speeds[i] + phases[i]);
      const lift = Math.max(0, wave);
      const next = baseBrightness[i] * (1.0 + lift * lifts[i]);
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
      frustumCulled
      raycast={() => null}
    />
  );
}
