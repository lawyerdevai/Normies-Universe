"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { createRng } from "@/lib/universe/seededRandom";

const LAYERS = [
  { count: 9000, seed: 88001, size: [0.08, 0.28] as [number, number], brightness: [0.02, 0.07] as [number, number], spread: 1.4 },
  { count: 2800, seed: 88002, size: [0.2, 0.55] as [number, number], brightness: [0.05, 0.14] as [number, number], spread: 1.0 },
  { count: 900, seed: 88003, size: [0.45, 1.1] as [number, number], brightness: [0.1, 0.28] as [number, number], spread: 0.65 },
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
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 32.0);
    float halo = exp(-d * d * 7.0) * 0.25;
    float alpha = (core + halo) * vBrightness;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vColor * (core + halo * 0.3), alpha);
  }
`;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export default function BackgroundStars() {
  const { geometry, material } = useMemo(() => {
    const total = LAYERS.reduce((s, l) => s + l.count, 0);
    const positions = new Float32Array(total * 3);
    const sizes = new Float32Array(total);
    const brightness = new Float32Array(total);
    const colors = new Float32Array(total * 3);

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
        brightness[idx] = lerp(layer.brightness[0], layer.brightness[1], rng());

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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    return { geometry, material };
  }, []);

  return (
    <points
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={() => null}
    />
  );
}
