"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import AbsorbedBurnStars, {
  type AbsorbedHoverPayload,
} from "@/components/starform/AbsorbedBurnStars";
import {
  ConstellationFace,
  ViewportBleedStars,
} from "@/components/starform/ConstellationPoints";
import { DEFAULT_CAMERA_FOV } from "@/lib/universe/cameraConfig";
import type { ConstellationData } from "@/lib/universe/generateConstellation";

const GRID_SIZE = 40;
const VIEWPORT_HEIGHT_FRACTION = 0.75;
const CAMERA_Z = 50;
const ARRIVAL_START_Z = 8;
const ARRIVAL_DURATION = 2;
const CONSTELLATION_FADE_DURATION = 0.5;
const CAMERA_NEAR = 0.01;
const CAMERA_FAR = 10000;
export const STARFORM_BACKGROUND_SPACE = "#050a15";
export const STARFORM_BACKGROUND_SKY = "#0a0a2e";
const BACKGROUND_TRANSITION_SECONDS = 0.8;
const Y_OFFSET_FRACTION = 0.05;

function TransitionBackground({ color }: { color: string }) {
  const { scene } = useThree();
  const targetRef = useRef(new THREE.Color(color));

  useLayoutEffect(() => {
    if (!(scene.background instanceof THREE.Color)) {
      scene.background = new THREE.Color(color);
    }
  }, [scene, color]);

  useEffect(() => {
    targetRef.current.set(color);
  }, [color]);

  useFrame((_, delta) => {
    const bg = scene.background;
    if (!(bg instanceof THREE.Color)) return;
    const step = Math.min(1, delta / BACKGROUND_TRANSITION_SECONDS);
    bg.lerp(targetRef.current, step);
  });

  return null;
}

function ArrivalCamera() {
  const { camera } = useThree();
  const startTimeRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    camera.position.set(0, 0, ARRIVAL_START_Z);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    startTimeRef.current = null;
  }, [camera]);

  useFrame((state) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const t = Math.min(1, elapsed / ARRIVAL_DURATION);
    const eased = 1 - (1 - t) ** 3;
    camera.position.z = THREE.MathUtils.lerp(ARRIVAL_START_Z, CAMERA_Z, eased);
  });

  return null;
}

function ConstellationLayer({
  constellation,
  tokenId,
  reveal,
  showAbsorbed,
  absorbedHoverTokenId,
  absorbedSelectedTokenId,
  onAbsorbedHover,
  onAbsorbedSelect,
}: {
  constellation: ConstellationData;
  tokenId: number;
  reveal: boolean;
  showAbsorbed: boolean;
  absorbedHoverTokenId: number | null;
  absorbedSelectedTokenId: number | null;
  onAbsorbedHover: (payload: AbsorbedHoverPayload | null) => void;
  onAbsorbedSelect: (tokenId: number) => void;
}) {
  const opacityRef = useRef(0);
  const constellationMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const absorbedMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  const { scale, yOffset } = useMemo(() => {
    const fovRad = (DEFAULT_CAMERA_FOV * Math.PI) / 180;
    const visibleHeight = 2 * Math.tan(fovRad / 2) * CAMERA_Z;
    const targetHeight = visibleHeight * VIEWPORT_HEIGHT_FRACTION;
    return {
      scale: targetHeight / GRID_SIZE,
      yOffset: visibleHeight * Y_OFFSET_FRACTION,
    };
  }, []);

  useFrame((_, delta) => {
    const target = reveal ? 1 : 0;
    const step = delta / CONSTELLATION_FADE_DURATION;

    if (opacityRef.current < target) {
      opacityRef.current = Math.min(target, opacityRef.current + step);
    } else if (opacityRef.current > target) {
      opacityRef.current = Math.max(target, opacityRef.current - step);
    }

    if (constellationMaterialRef.current) {
      constellationMaterialRef.current.opacity = opacityRef.current;
    }
    if (absorbedMaterialRef.current) {
      absorbedMaterialRef.current.opacity = opacityRef.current;
    }
  });

  return (
    <>
      {showAbsorbed ? (
        <AbsorbedBurnStars
          receiverTokenId={tokenId}
          hoveredTokenId={absorbedHoverTokenId}
          selectedTokenId={absorbedSelectedTokenId}
          onHover={onAbsorbedHover}
          onSelect={onAbsorbedSelect}
          materialRef={absorbedMaterialRef}
        />
      ) : null}
      <group position={[0, yOffset, 0]}>
        <group scale={[scale, scale, 1]}>
          <ConstellationFace
            constellation={constellation}
            tokenId={tokenId}
            materialRef={constellationMaterialRef}
          />
        </group>
      </group>
    </>
  );
}

interface StarformSceneProps {
  tokenId: number;
  backgroundColor: string;
  constellation?: ConstellationData;
  constellationReveal: boolean;
  showAbsorbed: boolean;
  absorbedHoverTokenId: number | null;
  absorbedSelectedTokenId: number | null;
  onAbsorbedHover: (payload: AbsorbedHoverPayload | null) => void;
  onAbsorbedSelect: (tokenId: number) => void;
}

export default function StarformScene({
  tokenId,
  backgroundColor,
  constellation,
  constellationReveal,
  showAbsorbed,
  absorbedHoverTokenId,
  absorbedSelectedTokenId,
  onAbsorbedHover,
  onAbsorbedSelect,
}: StarformSceneProps) {
  return (
    <Canvas
      key={tokenId}
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
      <TransitionBackground color={backgroundColor} />
      <ArrivalCamera />
      <ViewportBleedStars tokenId={tokenId} />
      {constellation ? (
        <ConstellationLayer
          constellation={constellation}
          tokenId={tokenId}
          reveal={constellationReveal}
          showAbsorbed={showAbsorbed}
          absorbedHoverTokenId={absorbedHoverTokenId}
          absorbedSelectedTokenId={absorbedSelectedTokenId}
          onAbsorbedHover={onAbsorbedHover}
          onAbsorbedSelect={onAbsorbedSelect}
        />
      ) : null}
    </Canvas>
  );
}
