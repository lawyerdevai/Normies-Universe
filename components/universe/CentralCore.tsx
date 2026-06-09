"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

interface CentralCoreProps {
  isHovered: boolean;
  isSelected: boolean;
  reducedMotion?: boolean;
  onClick: () => void;
  onHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
}

export default function CentralCore({
  isHovered,
  isSelected,
  reducedMotion = false,
  onClick,
  onHover,
}: CentralCoreProps) {
  const barRef = useRef<THREE.Mesh>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const outerHaloRef = useRef<THREE.Mesh>(null);

  const { barMat, coreMat, haloMat, outerMat } = useMemo(() => {
    const barMat = new THREE.MeshBasicMaterial({
      color: "#e8e8ec",
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const coreMat = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.9,
      toneMapped: false,
    });
    const haloMat = new THREE.MeshBasicMaterial({
      color: "#d8d8e0",
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const outerMat = new THREE.MeshBasicMaterial({
      color: "#a0a0b0",
      transparent: true,
      opacity: 0.04,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { barMat, coreMat, haloMat, outerMat };
  }, []);

  useFrame(({ clock }) => {
    const hoverBoost = isHovered ? 1.1 : 1;
    const selectBoost = isSelected ? 1.06 : 1;
    const pulse = reducedMotion
      ? 1
      : 1 + Math.sin(clock.elapsedTime * 0.5) * 0.03;

    if (barRef.current) {
      barRef.current.scale.set(9 * pulse, 2.2 * pulse, 3.5 * pulse);
      barMat.opacity = (isHovered ? 0.45 : 0.32) * hoverBoost;
    }
    if (coreRef.current) {
      coreRef.current.scale.setScalar(2.8 * pulse * hoverBoost * selectBoost);
    }
    if (haloRef.current) {
      haloRef.current.scale.setScalar(6.5 * pulse * hoverBoost);
      haloMat.opacity = isHovered ? 0.2 : 0.12;
    }
    if (outerHaloRef.current) {
      outerHaloRef.current.scale.setScalar(13 * pulse);
    }
  });

  return (
    <group name="central-core" rotation={[0, 0, 0.35]}>
      <mesh ref={outerHaloRef} material={outerMat}>
        <sphereGeometry args={[1, 16, 16]} />
      </mesh>
      <mesh ref={haloRef} material={haloMat}>
        <sphereGeometry args={[1, 16, 16]} />
      </mesh>
      <mesh ref={barRef} material={barMat}>
        <sphereGeometry args={[1, 12, 12]} />
      </mesh>
      <mesh
        ref={coreRef}
        material={coreMat}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          onHover(true, { x: e.clientX, y: e.clientY });
          document.body.style.cursor = "pointer";
        }}
        onPointerMove={(e) => onHover(true, { x: e.clientX, y: e.clientY })}
        onPointerOut={() => {
          onHover(false);
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[1, 24, 24]} />
      </mesh>
    </group>
  );
}
