"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { generatePyreParticles } from "@/lib/universe/generatePyre";

const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_SCALE = 1.15;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute vec3 color;
  uniform float uHoverBoost;
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vBrightness = aBrightness * uHoverBoost;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 22.0);
    float halo = exp(-d * d * 5.5) * 0.28;
    float alpha = (core + halo) * vBrightness;
    if (alpha < 0.003) discard;
    vec3 lit = vColor * (core * 1.35 + halo * 0.4);
    gl_FragColor = vec4(lit, alpha);
  }
`;

interface CentralCoreProps {
  isHovered: boolean;
  isSelected: boolean;
  reducedMotion?: boolean;
  debugEnabled?: boolean;
  onClick: () => void;
  onHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
}

export default function CentralCore({
  isHovered,
  reducedMotion = false,
  debugEnabled = true,
  onHover,
}: CentralCoreProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particles = useMemo(() => generatePyreParticles(), []);

  const { geometry, material, animMeta } = useMemo(() => {
    const count = particles.length;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const flickerSpeeds = new Float32Array(count);
    const flarePhases = new Float32Array(count);
    const flareStrengths = new Float32Array(count);
    const baseBrightness = new Float32Array(count);

    particles.forEach((p, i) => {
      positions[i * 3] = p.position[0];
      positions[i * 3 + 1] = p.position[1];
      positions[i * 3 + 2] = p.position[2];
      sizes[i] = p.size;
      brightness[i] = p.baseBrightness;
      baseBrightness[i] = p.baseBrightness;
      colors[i * 3] = p.color[0];
      colors[i * 3 + 1] = p.color[1];
      colors[i * 3 + 2] = p.color[2];
      phases[i] = p.phase;
      flickerSpeeds[i] = p.flickerSpeed;
      flarePhases[i] = p.flarePhase;
      flareStrengths[i] = p.flareStrength;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHoverBoost: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    return {
      geometry,
      material,
      animMeta: {
        phases,
        flickerSpeeds,
        flarePhases,
        flareStrengths,
        baseBrightness,
      },
    };
  }, [particles]);

  const hitMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.raycast = () => {};
    }
  });

  useFrame(({ clock }) => {
    material.uniforms.uHoverBoost.value = isHovered ? 1.1 : 1;

    if (reducedMotion) return;

    const t = clock.elapsedTime;
    const brightnessAttr = geometry.getAttribute(
      "aBrightness",
    ) as THREE.BufferAttribute;
    const {
      phases,
      flickerSpeeds,
      flarePhases,
      flareStrengths,
      baseBrightness,
    } = animMeta;

    for (let i = 0; i < particles.length; i++) {
      const base = baseBrightness[i];
      const flicker =
        0.86 +
        0.14 * Math.sin(t * flickerSpeeds[i] + phases[i]) +
        0.04 * Math.sin(t * flickerSpeeds[i] * 2.3 + phases[i] * 1.7);

      const flareWave = Math.sin(t * 0.55 + flarePhases[i]);
      let flare = 1;
      if (flareWave > 0.94) {
        flare += (flareWave - 0.94) * flareStrengths[i] * 12;
      }

      brightnessAttr.setX(i, base * flicker * flare);
    }
    brightnessAttr.needsUpdate = true;
  });

  const handlePointer = (e: ThreeEvent<PointerEvent>, entering: boolean) => {
    e.stopPropagation();
    if (entering) {
      onHover(true, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    } else {
      onHover(false);
    }
  };

  if (!debugEnabled) return null;

  return (
    <group rotation={GALAXY_EULER} scale={GALAXY_SCALE}>
      <points
        ref={pointsRef}
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={18}
        raycast={() => null}
      />
      <mesh
        material={hitMaterial}
        renderOrder={17}
        onPointerOver={(e) => handlePointer(e, true)}
        onPointerMove={(e: ThreeEvent<PointerEvent>) =>
          onHover(true, {
            x: e.nativeEvent.clientX,
            y: e.nativeEvent.clientY,
          })
        }
        onPointerOut={(e) => handlePointer(e, false)}
      >
        <sphereGeometry args={[6.2, 12, 12]} />
      </mesh>
    </group>
  );
}
