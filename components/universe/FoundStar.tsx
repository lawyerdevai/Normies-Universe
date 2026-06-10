"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { LOCATOR_HIGHLIGHT_SCREEN_PX } from "@/lib/universe/screenSpaceLocator";

function starTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.08, "rgba(255,255,255,0.92)");
  g.addColorStop(0.22, "rgba(255,255,255,0.35)");
  g.addColorStop(0.42, "rgba(255,255,255,0.06)");
  g.addColorStop(0.58, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

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
        map: starTexture(),
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
    const shimmer = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 2.2);
    const px = LOCATOR_HIGHLIGHT_SCREEN_PX * blend.current * shimmer;
    const s = px * pixelWorld * dist;
    mesh.scale.set(s, s, 1);
    material.opacity = blend.current;
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
