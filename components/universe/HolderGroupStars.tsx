"use client";

import { type ThreeEvent, useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { HolderGroupStar } from "@/types/universe";

interface HolderGroupStarsProps {
  groups: HolderGroupStar[];
  hoveredId: string | null;
  selectedId: string | null;
  reducedMotion?: boolean;
  onHover: (
    group: HolderGroupStar | null,
    screenPos?: { x: number; y: number },
  ) => void;
  onSelect: (group: HolderGroupStar) => void;
}

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _scale = new THREE.Vector3();

function phaseFromId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % 628;
  return hash / 100;
}

export default function HolderGroupStars({
  groups,
  hoveredId,
  selectedId,
  reducedMotion,
  onHover,
  onSelect,
}: HolderGroupStarsProps) {
  const coreRef = useRef<THREE.InstancedMesh>(null);
  const haloRef = useRef<THREE.InstancedMesh>(null);

  const { coreMaterial, haloMaterial } = useMemo(() => {
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: "#f0f0f4",
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: "#e0e0ea",
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    return { coreMaterial, haloMaterial };
  }, []);

  useLayoutEffect(() => {
    if (!coreRef.current || !haloRef.current) return;

    groups.forEach((group, i) => {
      _position.set(...group.position);
      _scale.setScalar(group.size);
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      coreRef.current!.setMatrixAt(i, _matrix);

      _scale.setScalar(group.size * 3.2);
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      haloRef.current!.setMatrixAt(i, _matrix);
    });

    coreRef.current.instanceMatrix.needsUpdate = true;
    haloRef.current.instanceMatrix.needsUpdate = true;
  }, [groups]);

  useFrame(({ clock }) => {
    if (!coreRef.current || !haloRef.current) return;

    const t = clock.elapsedTime;
    const anyActive = hoveredId || selectedId;

    groups.forEach((group, i) => {
      const isHovered = hoveredId === group.id;
      const isSelected = selectedId === group.id;
      const shimmer = reducedMotion
        ? 1
        : 1 + Math.sin(t * 0.9 + phaseFromId(group.id)) * 0.025;
      const hoverBoost = isHovered ? 1.25 : 1;
      const selectBoost = isSelected ? 1.1 : 1;
      const scale = group.size * shimmer * hoverBoost * selectBoost;

      _position.set(...group.position);
      _scale.setScalar(scale);
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      coreRef.current!.setMatrixAt(i, _matrix);

      _scale.setScalar(scale * (isHovered ? 3.8 : 3.0));
      _matrix.compose(_position, new THREE.Quaternion(), _scale);
      haloRef.current!.setMatrixAt(i, _matrix);
    });

    coreRef.current.instanceMatrix.needsUpdate = true;
    haloRef.current.instanceMatrix.needsUpdate = true;

    coreMaterial.opacity = anyActive ? 0.98 : 0.88;
    haloMaterial.opacity = hoveredId ? 0.28 : selectedId ? 0.2 : 0.12;
  });

  const handlePointer = (e: ThreeEvent<PointerEvent>, entering: boolean) => {
    e.stopPropagation();
    if (e.instanceId === undefined) {
      onHover(null);
      document.body.style.cursor = "default";
      return;
    }
    const group = groups[e.instanceId];
    if (entering) {
      document.body.style.cursor = "pointer";
      onHover(group, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    } else {
      document.body.style.cursor = "default";
      onHover(null);
    }
  };

  return (
    <group name="holder-group-stars">
      <instancedMesh
        ref={haloRef}
        args={[undefined, haloMaterial, groups.length]}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 8]} />
      </instancedMesh>
      <instancedMesh
        ref={coreRef}
        args={[undefined, coreMaterial, groups.length]}
        frustumCulled={false}
        onClick={(e) => {
          e.stopPropagation();
          if (e.instanceId !== undefined) onSelect(groups[e.instanceId]);
        }}
        onPointerOver={(e) => handlePointer(e, true)}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          if (e.instanceId !== undefined) {
            onHover(groups[e.instanceId], {
              x: e.nativeEvent.clientX,
              y: e.nativeEvent.clientY,
            });
          }
        }}
        onPointerOut={(e) => handlePointer(e, false)}
      >
        <sphereGeometry args={[1, 10, 10]} />
      </instancedMesh>
    </group>
  );
}
