"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { generateGalaxyAtmosphere } from "@/lib/universe/generateGalaxyAtmosphere";

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
    gl_PointSize = aSize * (280.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 18.0);
    float halo = exp(-d * d * 4.5) * 0.5;
    float alpha = (core + halo) * vBrightness;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(vColor * (core + halo * 0.35), alpha);
  }
`;

export default function GalaxyAtmosphere() {
  const { geometry, material } = useMemo(() => {
    const particles = generateGalaxyAtmosphere();
    const positions = new Float32Array(particles.length * 3);
    const sizes = new Float32Array(particles.length);
    const brightness = new Float32Array(particles.length);
    const colors = new Float32Array(particles.length * 3);

    particles.forEach((p, i) => {
      positions[i * 3] = p.position[0];
      positions[i * 3 + 1] = p.position[1];
      positions[i * 3 + 2] = p.position[2];
      sizes[i] = p.size;
      brightness[i] = p.brightness;
      colors[i * 3] = p.color[0];
      colors[i * 3 + 1] = p.color[1];
      colors[i * 3 + 2] = p.color[2];
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

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
    <group rotation={[0.28, 0.15, 0.35]} scale={1.15}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
