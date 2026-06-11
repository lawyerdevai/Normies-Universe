"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  DEFAULT_CAMERA_POSITION,
  DEFAULT_CAMERA_TARGET,
} from "@/lib/universe/cameraConfig";

/** Search may move at most 20% closer than the active orbit distance. */
const SEARCH_MAX_ZOOM_IN_RATIO = 0.8;
/** Skip zoom-in when a reference marker already reads this large on screen. */
const SEARCH_CLEAR_VISIBILITY_PX = 8;
const SEARCH_VISIBILITY_REFERENCE_WORLD = 3.5;

interface CameraRigProps {
  reducedMotion?: boolean;
  controlsRef: React.RefObject<THREE.EventDispatcher | null>;
  resetKey: number;
  searchFocus: [number, number, number] | null;
  searchFocusKey: number;
}

function pixelWorldFactor(camera: THREE.PerspectiveCamera, viewportHeight: number) {
  return (2 * Math.tan((camera.fov * Math.PI) / 360)) / viewportHeight;
}

function referenceStarScreenPx(
  cameraPos: THREE.Vector3,
  starPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
) {
  const dist = Math.max(0.1, cameraPos.distanceTo(starPos));
  const pixelWorld = pixelWorldFactor(camera, viewportHeight);
  return SEARCH_VISIBILITY_REFERENCE_WORLD / (pixelWorld * dist);
}

function isStarClearlyVisible(
  cameraPos: THREE.Vector3,
  starPos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
) {
  return (
    referenceStarScreenPx(cameraPos, starPos, camera, viewportHeight) >=
    SEARCH_CLEAR_VISIBILITY_PX
  );
}

function cameraPoseForSearch(
  starPosition: [number, number, number],
  camera: THREE.PerspectiveCamera,
  controlsTarget: THREE.Vector3,
  viewportHeight: number,
) {
  const star = new THREE.Vector3(...starPosition);
  const offset = camera.position.clone().sub(controlsTarget);
  if (offset.lengthSq() < 1e-6) {
    offset.copy(DEFAULT_CAMERA_POSITION).sub(DEFAULT_CAMERA_TARGET);
  }

  const currentDistance = offset.length();
  const panCamera = star.clone().add(offset);

  let targetDistance = currentDistance;
  if (
    !isStarClearlyVisible(panCamera, star, camera, viewportHeight) &&
    currentDistance > 1e-3
  ) {
    targetDistance = currentDistance * SEARCH_MAX_ZOOM_IN_RATIO;
  }

  if (targetDistance < currentDistance - 1e-3) {
    offset.normalize().multiplyScalar(targetDistance);
  }

  return {
    camera: star.clone().add(offset),
    target: star,
  };
}

export default function CameraRig({
  reducedMotion = false,
  controlsRef,
  resetKey,
  searchFocus,
  searchFocusKey,
}: CameraRigProps) {
  const { camera, size } = useThree();
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
    if (searchFocus) {
      const controls = controlsRef.current as { target: THREE.Vector3 } | null;
      const controlsTarget =
        controls?.target.clone() ?? DEFAULT_CAMERA_TARGET.clone();
      const { camera: camPos, target } = cameraPoseForSearch(
        searchFocus,
        camera as THREE.PerspectiveCamera,
        controlsTarget,
        size.height,
      );
      const duration = reducedMotion ? 0.01 : 2.1;
      animateTo(camPos, target, duration);
      return;
    }

    if (resetKey > 0) {
      idleOffset.current = { x: 0, y: 0 };
      const duration = reducedMotion ? 0.01 : 1.4;
      animateTo(
        DEFAULT_CAMERA_POSITION.clone(),
        DEFAULT_CAMERA_TARGET.clone(),
        duration,
      );
      return;
    }

    if (searchFocusKey > 0) {
      const duration = reducedMotion ? 0.01 : 2.1;
      animateTo(
        DEFAULT_CAMERA_POSITION.clone(),
        DEFAULT_CAMERA_TARGET.clone(),
        duration,
      );
    }
  }, [
    searchFocus,
    searchFocusKey,
    resetKey,
    reducedMotion,
    camera,
    controlsRef,
    size.height,
  ]);

  useFrame(({ clock }) => {
    if (reducedMotion || animating.current || searchFocus) {
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
