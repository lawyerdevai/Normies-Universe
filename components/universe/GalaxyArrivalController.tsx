"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { createContext, useContext, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@/lib/universe/cameraConfig";
import {
  computeGalaxyReveal,
  DEFAULT_GALAXY_REVEAL,
  GALAXY_ARRIVAL_CAMERA_START_RATIO,
  GALAXY_ARRIVAL_TRAVEL_SECONDS,
  type GalaxyRevealState,
} from "@/lib/universe/galaxyArrival";

const GalaxyRevealRefContext = createContext<React.RefObject<GalaxyRevealState>>(
  { current: DEFAULT_GALAXY_REVEAL },
);

export function useGalaxyRevealRef() {
  return useContext(GalaxyRevealRefContext);
}

interface GalaxyArrivalControllerProps {
  active: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  children: React.ReactNode;
}

export default function GalaxyArrivalController({
  active,
  controlsRef,
  children,
}: GalaxyArrivalControllerProps) {
  const { camera } = useThree();
  const startTimeRef = useRef<number | null>(null);
  const travelDoneRef = useRef(false);
  const startPositionRef = useRef(new THREE.Vector3());
  const revealRef = useRef<GalaxyRevealState>({ ...DEFAULT_GALAXY_REVEAL });

  useLayoutEffect(() => {
    if (!active) {
      travelDoneRef.current = false;
      startTimeRef.current = null;
      revealRef.current = { ...DEFAULT_GALAXY_REVEAL };
      const controls = controlsRef.current;
      if (controls) controls.enabled = true;
      return;
    }

    startPositionRef.current
      .copy(DEFAULT_CAMERA_POSITION)
      .multiplyScalar(GALAXY_ARRIVAL_CAMERA_START_RATIO);
    camera.position.copy(startPositionRef.current);
    camera.lookAt(DEFAULT_CAMERA_TARGET);

    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(DEFAULT_CAMERA_TARGET);
      controls.enabled = false;
      controls.update();
    }

    startTimeRef.current = null;
    travelDoneRef.current = false;
    revealRef.current = {
      active: true,
      elapsed: 0,
      core: 0,
      holders: 0,
      arms: 0,
      outer: 0,
    };
  }, [active, camera, controlsRef]);

  useFrame((state) => {
    if (!active) return;

    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const travelT = Math.min(1, elapsed / GALAXY_ARRIVAL_TRAVEL_SECONDS);
    const eased = 1 - (1 - travelT) ** 3;

    camera.position.lerpVectors(
      startPositionRef.current,
      DEFAULT_CAMERA_POSITION,
      eased,
    );

    if (travelT >= 1 && !travelDoneRef.current) {
      travelDoneRef.current = true;
      const controls = controlsRef.current;
      if (controls) {
        controls.enabled = true;
        controls.update();
      }
    }

    const layers = computeGalaxyReveal(elapsed);
    revealRef.current = {
      active: true,
      elapsed,
      ...layers,
    };
  });

  return (
    <GalaxyRevealRefContext.Provider value={revealRef}>
      {children}
    </GalaxyRevealRefContext.Provider>
  );
}
