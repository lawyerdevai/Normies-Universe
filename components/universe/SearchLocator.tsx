"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

const DIM_IN_MS = 300;
const PING_MS = 3000;

interface SearchLocatorProps {
  dimKey: number;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function dimOpacity(elapsedMs: number): number {
  const fadeIn = Math.min(1, elapsedMs / DIM_IN_MS);
  const holdEnd = PING_MS - DIM_IN_MS;
  if (elapsedMs <= holdEnd) return easeOutCubic(fadeIn) * 0.6;
  const fadeOut = (elapsedMs - holdEnd) / DIM_IN_MS;
  return (1 - easeOutCubic(Math.min(1, fadeOut))) * 0.6;
}

/** Brief scene dim on search — nothing else. */
export default function SearchLocator({ dimKey }: SearchLocatorProps) {
  const { camera } = useThree();
  const pingStartMs = useRef(performance.now());
  const dimRef = useRef<THREE.Mesh>(null);
  const dimMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  useLayoutEffect(() => {
    if (dimKey === 0) return;
    pingStartMs.current = performance.now();
  }, [dimKey]);

  useFrame(() => {
    if (dimKey === 0 || !dimRef.current) {
      dimMat.opacity = 0;
      dimRef.current && (dimRef.current.visible = false);
      return;
    }

    const elapsed = performance.now() - pingStartMs.current;
    const dim = dimOpacity(elapsed);
    dimMat.opacity = dim;

    const dist = 12;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion,
    );
    dimRef.current.position.copy(camera.position).addScaledVector(forward, dist);
    dimRef.current.quaternion.copy(camera.quaternion);
    const persp = camera as THREE.PerspectiveCamera;
    const vFov = (persp.fov * Math.PI) / 180;
    const height = 2 * Math.tan(vFov / 2) * dist;
    const width = height * persp.aspect;
    dimRef.current.scale.set(width * 1.25, height * 1.25, 1);
    dimRef.current.visible = dim > 0.01;
  });

  if (dimKey === 0) return null;

  return (
    <mesh
      ref={dimRef}
      name="search-locator-dim"
      material={dimMat}
      renderOrder={50}
      frustumCulled={false}
      visible={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}
