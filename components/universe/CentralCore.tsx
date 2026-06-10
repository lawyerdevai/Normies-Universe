"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { generatePyreParticles } from "@/lib/universe/generatePyre";
import { isPointerOverPyre } from "@/lib/universe/isPointerOverPyre";
import type { HolderGroupStar } from "@/types/universe";

const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_SCALE = 1.15;
const THUNDER_DURATION = 0.42;

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute float aFlare;
  attribute vec3 color;
  uniform float uHoverBoost;
  uniform float uFieldPulse;
  varying float vBrightness;
  varying float vFlare;
  varying vec3 vColor;

  void main() {
    vColor = color;
    vFlare = aFlare;
    vBrightness = aBrightness * uHoverBoost * uFieldPulse;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (340.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  varying float vBrightness;
  varying float vFlare;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = exp(-d * d * 30.0);
    float halo = exp(-d * d * 7.0) * 0.16;
    float alpha = (core + halo) * vBrightness;
    if (alpha < 0.003) discard;

    vec3 hot = vec3(1.0, 0.96, 0.88);
    vec3 base = mix(vColor, hot, vFlare * 0.82);
    vec3 lit = base * (core * 1.28 + halo * 0.32 + vFlare * 0.45);
    gl_FragColor = vec4(lit, alpha);
  }
`;

function pointerScreenPos(
  pointer: THREE.Vector2,
  viewport: { width: number; height: number },
  canvasRect: DOMRect,
) {
  return {
    x: canvasRect.left + (pointer.x * 0.5 + 0.5) * viewport.width,
    y: canvasRect.top + (-pointer.y * 0.5 + 0.5) * viewport.height,
  };
}

interface CentralCoreProps {
  isHovered: boolean;
  reducedMotion?: boolean;
  debugEnabled?: boolean;
  starHoverRef?: React.RefObject<HolderGroupStar | null>;
  pyreLocatorKey?: number;
  onHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
}

export default function CentralCore({
  isHovered,
  reducedMotion = false,
  debugEnabled = true,
  starHoverRef,
  pyreLocatorKey = 0,
  onHover,
}: CentralCoreProps) {
  const { camera, pointer, size, gl } = useThree();
  const lastPyreHover = useRef(false);
  const pointsRef = useRef<THREE.Points>(null);
  const thunderRef = useRef({
    startTime: -999,
    nextAt: 6 + Math.random() * 5,
  });
  const locatorFlareRef = useRef({ startMs: 0, active: false });

  useLayoutEffect(() => {
    if (pyreLocatorKey === 0) return;
    locatorFlareRef.current = { startMs: performance.now(), active: true };
  }, [pyreLocatorKey]);
  const particles = useMemo(() => generatePyreParticles(), []);

  const { geometry, material, animMeta } = useMemo(() => {
    const count = particles.length;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const brightness = new Float32Array(count);
    const flares = new Float32Array(count);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const flickerSpeeds = new Float32Array(count);
    const baseBrightness = new Float32Array(count);

    particles.forEach((p, i) => {
      positions[i * 3] = p.position[0];
      positions[i * 3 + 1] = p.position[1];
      positions[i * 3 + 2] = p.position[2];
      sizes[i] = p.size;
      brightness[i] = p.baseBrightness;
      baseBrightness[i] = p.baseBrightness;
      flares[i] = 0;
      colors[i * 3] = p.color[0];
      colors[i * 3 + 1] = p.color[1];
      colors[i * 3 + 2] = p.color[2];
      phases[i] = p.phase;
      flickerSpeeds[i] = p.flickerSpeed;
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute("aBrightness", new THREE.BufferAttribute(brightness, 1));
    geometry.setAttribute("aFlare", new THREE.BufferAttribute(flares, 1));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uHoverBoost: { value: 1 },
        uFieldPulse: { value: 1 },
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
        baseBrightness,
      },
    };
  }, [particles]);

  useLayoutEffect(() => {
    if (pointsRef.current) {
      pointsRef.current.raycast = () => {};
    }
  });

  function thunderEnvelope(age: number) {
    if (age < 0 || age >= THUNDER_DURATION) return 0;
    const attack = 0.06;
    if (age < attack) return age / attack;
    const decay = (age - attack) / (THUNDER_DURATION - attack);
    return 1 - decay * decay;
  }

  useFrame(({ clock }) => {
    if (starHoverRef?.current) {
      if (lastPyreHover.current) {
        lastPyreHover.current = false;
        onHover(false);
      }
    } else {
      const overPyre = isPointerOverPyre(pointer, camera, size);

      if (overPyre !== lastPyreHover.current) {
        lastPyreHover.current = overPyre;
        if (overPyre) {
          onHover(
            true,
            pointerScreenPos(
              pointer,
              size,
              gl.domElement.getBoundingClientRect(),
            ),
          );
        } else {
          onHover(false);
        }
      } else if (overPyre) {
        onHover(
          true,
          pointerScreenPos(
            pointer,
            size,
            gl.domElement.getBoundingClientRect(),
          ),
        );
      }
    }

    material.uniforms.uHoverBoost.value = isHovered ? 1.1 : 1;

    const brightnessAttr = geometry.getAttribute(
      "aBrightness",
    ) as THREE.BufferAttribute;
    const flareAttr = geometry.getAttribute(
      "aFlare",
    ) as THREE.BufferAttribute;
    const { phases, flickerSpeeds, baseBrightness } = animMeta;

    const t = clock.elapsedTime;
    const fieldPulse =
      0.955 +
      0.03 * Math.sin(t * 0.31) +
      0.018 * Math.sin(t * 0.53 + 1.1);

    let thunder = 0;
    if (!reducedMotion) {
      const thunderState = thunderRef.current;
      if (t >= thunderState.nextAt) {
        thunderState.startTime = t;
        thunderState.nextAt = t + 8 + Math.random() * 5;
      }
      thunder = thunderEnvelope(t - thunderState.startTime);
    }

    let locatorFlare = 0;
    const locatorState = locatorFlareRef.current;
    if (locatorState.active) {
      const age = (performance.now() - locatorState.startMs) / 1000;
      if (age > 3) {
        locatorState.active = false;
      } else {
        locatorFlare =
          Math.sin(Math.min(age / 0.35, 1) * Math.PI * 0.5) *
          (age < 2.6 ? 1 : 1 - (age - 2.6) / 0.4);
      }
    }

    material.uniforms.uFieldPulse.value = reducedMotion
      ? 1
      : fieldPulse * (1 + thunder * 0.1 + locatorFlare * 0.35);

    if (reducedMotion) return;

    for (let i = 0; i < particles.length; i++) {
      const base = baseBrightness[i];
      const phase = phases[i];
      const speed = flickerSpeeds[i];

      const slow = Math.sin(t * speed + phase);
      const fast = Math.sin(t * speed * 2.7 + phase * 1.55);
      const shimmer = Math.sin(t * speed * 4.1 + phase * 2.2);

      const flicker = 0.56 + 0.36 * slow + 0.14 * fast + 0.06 * shimmer;
      const glint =
        Math.max(0, slow - 0.35) * Math.max(0, fast) * 0.75 +
        Math.max(0, shimmer - 0.6) * 0.2;

      brightnessAttr.setX(
        i,
        base *
          flicker *
          (1 + glint * 0.35) *
          (1 + thunder * 0.32 + locatorFlare * 0.55),
      );
      flareAttr.setX(
        i,
        Math.max(glint, thunder * 0.38, locatorFlare * 0.72),
      );
    }

    brightnessAttr.needsUpdate = true;
    flareAttr.needsUpdate = true;
  });

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
    </group>
  );
}
