"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import BackgroundStars from "@/components/universe/BackgroundStars";
import {
  ConstellationFace,
  ViewportBleedStars,
} from "@/components/starform/ConstellationPoints";
import { DEFAULT_CAMERA_FOV } from "@/lib/universe/cameraConfig";
import type { ConstellationData } from "@/lib/universe/generateConstellation";

const GRID_SIZE = 40;
const VIEWPORT_HEIGHT_FRACTION = 0.75;
const CAMERA_Z = 50;
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 10000;
const BACKGROUND = "#050a15";
const Y_OFFSET_FRACTION = 0.05;

interface StarformSceneProps {
  constellation: ConstellationData;
  tokenId: number;
}

function ConstellationField({
  constellation,
  tokenId,
}: {
  constellation: ConstellationData;
  tokenId: number;
}) {
  const { scale, yOffset } = useMemo(() => {
    const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
    const targetHeight = visibleHeight * VIEWPORT_HEIGHT_FRACTION;
    return {
      scale: targetHeight / GRID_SIZE,
      yOffset: visibleHeight * Y_OFFSET_FRACTION,
    };
  }, []);

  return (
    <>
      <ViewportBleedStars tokenId={tokenId} />
      <group position={[0, yOffset, 0]}>
        <group scale={[scale, scale, 1]}>
          <ConstellationFace constellation={constellation} />
        </group>
      </group>
    </>
  );
}

export default function StarformScene({
  constellation,
  tokenId,
}: StarformSceneProps) {
  return (
    <Canvas
      camera={{
        position: [0, 0, CAMERA_Z],
        fov: DEFAULT_CAMERA_FOV,
        near: CAMERA_NEAR,
        far: CAMERA_FAR,
      }}
      gl={{
        antialias: true,
        alpha: false,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.9,
      }}
      className="absolute inset-0"
    >
      <color attach="background" args={[BACKGROUND]} />
      <BackgroundStars />
      <ConstellationField constellation={constellation} tokenId={tokenId} />
    </Canvas>
  );
}
