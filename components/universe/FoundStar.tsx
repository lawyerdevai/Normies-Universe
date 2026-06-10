"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LOCATOR_HIGHLIGHT_SCREEN_PX } from "@/lib/universe/screenSpaceLocator";
import {
  createHolderWarmStarTexture,
  HOLDER_SEARCH_WARM,
  searchBreathFactor,
} from "@/lib/universe/searchStarVisual";

interface FoundStarProps {
  position: [number, number, number];
  active: boolean;
}

export default function FoundStar({ position, active }: FoundStarProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const blend = useRef(0);
  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: createHolderWarmStarTexture(),
        color: HOLDER_SEARCH_WARM,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );

  useFrame(({ camera, size, clock }, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const goal = active ? 1 : 0;
    blend.current += (goal - blend.current) * Math.min(1, dt * 5);
    mesh.quaternion.copy(camera.quaternion);
    const persp = camera as THREE.PerspectiveCamera;
    const pixelWorld =
      (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
    const dist = mesh.position.distanceTo(camera.position);
    const breath = active ? searchBreathFactor(clock.elapsedTime) : 1;
    const px = LOCATOR_HIGHLIGHT_SCREEN_PX * blend.current * breath;
    const s = px * pixelWorld * dist;
    mesh.scale.set(s, s, 1);
    material.opacity = Math.min(1, blend.current * breath);
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={16}
    />
  );
}
