"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import type { CameraTarget } from "@/types/universe";

const OVERVIEW_POSITION = new THREE.Vector3(0, 48, 155);
const OVERVIEW_TARGET = new THREE.Vector3(0, 0, 0);

interface CameraRigProps {
  cameraTarget: CameraTarget;
  reducedMotion?: boolean;
  controlsRef: React.RefObject<THREE.EventDispatcher | null>;
}

export default function CameraRig({
  cameraTarget,
  reducedMotion = false,
  controlsRef,
}: CameraRigProps) {
  const { camera } = useThree();
  const animating = useRef(false);
  const idleOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const controls = controlsRef.current as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    if (!controls) return;

    animating.current = true;
    const duration = reducedMotion ? 0.01 : 2.1;

    let camPos = OVERVIEW_POSITION.clone();
    let lookAt = OVERVIEW_TARGET.clone();

    if (cameraTarget.type === "group" || cameraTarget.type === "search") {
      const [gx, gy, gz] =
        cameraTarget.type === "group"
          ? cameraTarget.group.position
          : cameraTarget.position;
      lookAt = new THREE.Vector3(gx, gy, gz);
      const dir = new THREE.Vector3(gx * 0.08, gy + 4, gz + 16)
        .sub(lookAt)
        .normalize()
        .multiplyScalar(20);
      camPos = lookAt.clone().add(dir);
    } else if (cameraTarget.type === "core") {
      camPos = new THREE.Vector3(0, 18, 38);
      lookAt = OVERVIEW_TARGET.clone();
    }

    gsap.to(camera.position, {
      x: camPos.x,
      y: camPos.y,
      z: camPos.z,
      duration,
      ease: "power2.inOut",
      onComplete: () => {
        animating.current = false;
      },
    });
    gsap.to(controls.target, {
      x: lookAt.x,
      y: lookAt.y,
      z: lookAt.z,
      duration,
      ease: "power2.inOut",
      onUpdate: () => controls.update(),
    });
  }, [cameraTarget, camera, controlsRef, reducedMotion]);

  useFrame(({ clock }) => {
    if (
      reducedMotion ||
      animating.current ||
      cameraTarget.type !== "overview" && cameraTarget.type !== "search"
    ) {
      return;
    }

    const t = clock.elapsedTime * 0.07;
    idleOffset.current.x = Math.sin(t) * 1.1;
    idleOffset.current.y = Math.cos(t * 0.65) * 0.5;

    camera.position.x = OVERVIEW_POSITION.x + idleOffset.current.x;
    camera.position.y = OVERVIEW_POSITION.y + idleOffset.current.y;

    const controls = controlsRef.current as { update: () => void } | null;
    controls?.update();
  });

  return null;
}
