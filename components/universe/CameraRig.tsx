"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@/lib/universe/cameraConfig";
interface CameraRigProps {
  reducedMotion?: boolean;
  controlsRef: React.RefObject<THREE.EventDispatcher | null>;
  resetKey: number;
}

export default function CameraRig({
  reducedMotion = false,
  controlsRef,
  resetKey,
}: CameraRigProps) {
  const { camera } = useThree();
  const animating = useRef(false);
  const idleOffset = useRef({ x: 0, y: 0 });
  const animateTo = (
    camPos: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number,
  ) => {
    const controls = controlsRef.current as {
      target: THREE.Vector3;
      update: () => void;
    } | null;
    if (!controls) return;

    animating.current = true;
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
  };

  useEffect(() => {
    if (resetKey === 0) return;
    idleOffset.current = { x: 0, y: 0 };
    const duration = reducedMotion ? 0.01 : 1.4;
    animateTo(
      DEFAULT_CAMERA_POSITION.clone(),
      DEFAULT_CAMERA_TARGET.clone(),
      duration,
    );
  }, [resetKey, reducedMotion, camera, controlsRef]);

  useFrame(({ clock }) => {
    if (reducedMotion || animating.current) {
      return;
    }

    const t = clock.elapsedTime * 0.07;
    idleOffset.current.x = Math.sin(t) * 1.1;
    idleOffset.current.y = Math.cos(t * 0.65) * 0.5;

    camera.position.x = DEFAULT_CAMERA_POSITION.x + idleOffset.current.x;
    camera.position.y = DEFAULT_CAMERA_POSITION.y + idleOffset.current.y;

    const controls = controlsRef.current as { update: () => void } | null;
    controls?.update();
  });

  return null;
}
