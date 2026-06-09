"use client";

import { useMemo } from "react";
import * as THREE from "three";

interface CentralCoreProps {
  isHovered: boolean;
  isSelected: boolean;
  reducedMotion?: boolean;
  debugEnabled?: boolean;
  onClick: () => void;
  onHover: (hovered: boolean, screenPos?: { x: number; y: number }) => void;
}

export default function CentralCore({
  debugEnabled = true,
  onClick,
  onHover,
}: CentralCoreProps) {
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

  return (
    <group
      rotation={[0.28, 0.15, 0.35]}
      scale={1.15}
      visible={debugEnabled}
    >
      <mesh
        material={hitMaterial}
        scale={[10.5, 3.2, 6.8]}
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
        <sphereGeometry args={[1, 10, 10]} />
      </mesh>
    </group>
  );
}
