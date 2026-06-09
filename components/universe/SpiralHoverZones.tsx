"use client";

import { type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import {
  SPIRAL_ZONES,
  zoneIndexForRadius,
  type SpiralZoneKey,
} from "@/lib/universe/spiralZones";

const GALAXY_EULER = new THREE.Euler(0.28, 0.15, 0.35, "XYZ");
const GALAXY_SCALE = 1.15;
const _local = new THREE.Vector3();
const _invEuler = new THREE.Euler(-0.28, -0.15, -0.35, "XYZ");

function zoneKeyFromWorldPoint(x: number, y: number, z: number): SpiralZoneKey {
  _local.set(x, y, z);
  _local.divideScalar(GALAXY_SCALE);
  _local.applyEuler(_invEuler);
  const r = Math.sqrt(_local.x * _local.x + _local.z * _local.z);
  return SPIRAL_ZONES[zoneIndexForRadius(r)].key;
}

interface SpiralHoverZonesProps {
  onZoneHover: (
    key: SpiralZoneKey | null,
    screenPos?: { x: number; y: number },
  ) => void;
}

export default function SpiralHoverZones({
  onZoneHover,
}: SpiralHoverZonesProps) {
  const activeZone = useRef<SpiralZoneKey | null>(null);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
      }),
    [],
  );

  const handlePointer = (e: ThreeEvent<PointerEvent>, entering: boolean) => {
    e.stopPropagation();
    if (entering) {
      const key = zoneKeyFromWorldPoint(e.point.x, e.point.y, e.point.z);
      activeZone.current = key;
      onZoneHover(key, { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    } else {
      activeZone.current = null;
      onZoneHover(null);
    }
  };

  return (
    <group name="spiral-hover-zones" rotation={GALAXY_EULER} scale={GALAXY_SCALE}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={2}
        onPointerOver={(e) => handlePointer(e, true)}
        onPointerMove={(e: ThreeEvent<PointerEvent>) => {
          const key = zoneKeyFromWorldPoint(e.point.x, e.point.y, e.point.z);
          if (key !== activeZone.current) {
            activeZone.current = key;
          }
          onZoneHover(key, {
            x: e.nativeEvent.clientX,
            y: e.nativeEvent.clientY,
          });
        }}
        onPointerOut={(e) => handlePointer(e, false)}
      >
        <circleGeometry args={[135, 64]} />
        <primitive object={material} attach="material" />
      </mesh>
    </group>
  );
}
