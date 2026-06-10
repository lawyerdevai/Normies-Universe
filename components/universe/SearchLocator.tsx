"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  TOP_TIER_LOCATOR_CORE,
  TOP_TIER_LOCATOR_GLOW,
  TOP_TIER_LOCATOR_GLOW_OPACITY,
} from "@/lib/universe/resolveSearch";
import type { LocatorTarget } from "@/types/universe";

const DIM_IN_MS = 300;
const PING_MS = 3000;
const PULSE_COUNT = 3;
const PULSE_DURATION = 0.85;
const GROW_MS = 400;
const SHRINK_MS = 450;

interface SearchLocatorProps {
  target: LocatorTarget | null;
  locatorKey: number;
  highlightPersist: boolean;
  onHighlightDismissed?: () => void;
}

function createStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.1, "rgba(255,248,220,0.95)");
  g.addColorStop(0.28, "rgba(255,220,160,0.45)");
  g.addColorStop(0.5, "rgba(255,180,100,0.12)");
  g.addColorStop(0.72, "rgba(255,140,60,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function dimOpacity(elapsedMs: number): number {
  const fadeIn = Math.min(1, elapsedMs / DIM_IN_MS);
  const holdEnd = PING_MS - DIM_IN_MS;
  if (elapsedMs <= holdEnd) return easeOutCubic(fadeIn) * 0.6;
  const fadeOut = (elapsedMs - holdEnd) / DIM_IN_MS;
  return (1 - easeOutCubic(Math.min(1, fadeOut))) * 0.6;
}

function pulseStrength(elapsedSec: number, pulseIndex: number): number {
  const start = 0.15 + pulseIndex * 0.75;
  const t = (elapsedSec - start) / PULSE_DURATION;
  if (t < 0 || t > 1) return 0;
  return (1 - t) * (1 - t) * 0.95;
}

function topTierWorldSize(
  position: THREE.Vector3,
  camera: THREE.Camera,
  size: { height: number },
) {
  const persp = camera as THREE.PerspectiveCamera;
  const dist = position.distanceTo(camera.position);
  const pixelWorld = (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
  const baseWorld =
    TOP_TIER_LOCATOR_CORE +
    TOP_TIER_LOCATOR_GLOW * TOP_TIER_LOCATOR_GLOW_OPACITY;
  const z = Math.max(
    0.1,
    -position.clone().applyMatrix4(camera.matrixWorldInverse).z,
  );
  return baseWorld * (235 / z) * pixelWorld * dist;
}

export default function SearchLocator({
  target,
  locatorKey,
  highlightPersist,
  onHighlightDismissed,
}: SearchLocatorProps) {
  const { camera, size, clock } = useThree();
  const pingStartMs = useRef(performance.now());
  const growStartMs = useRef(performance.now());
  const shrinkStartMs = useRef<number | null>(null);
  const shrinkFrom = useRef(1);
  const enlargeRef = useRef(0);
  const wasPersisting = useRef(false);
  const dismissedRef = useRef(false);
  const highlightPersistRef = useRef(highlightPersist);
  const worldPos = useMemo(() => new THREE.Vector3(), []);

  const dimRef = useRef<THREE.Mesh>(null);
  const dimMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#000000",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    [],
  );

  const highlightRef = useRef<THREE.Mesh>(null);
  const highlightMat = useMemo(() => {
    const tex = createStarTexture();
    return new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      color: "#ffffff",
    });
  }, []);

  const ringRefs = useRef<THREE.Mesh[]>([]);
  const ringMats = useMemo(
    () =>
      Array.from({ length: PULSE_COUNT }, () =>
        new THREE.MeshBasicMaterial({
          color: "#fff0c8",
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          toneMapped: false,
        }),
      ),
    [],
  );

  highlightPersistRef.current = highlightPersist;

  const resetLocatorTimers = () => {
    const now = performance.now();
    pingStartMs.current = now;
    growStartMs.current = now;
    shrinkStartMs.current = null;
    dismissedRef.current = false;
  };

  useLayoutEffect(() => {
    if (locatorKey === 0) return;
    resetLocatorTimers();
    wasPersisting.current = highlightPersist;
  }, [locatorKey, highlightPersist]);

  useLayoutEffect(() => {
    if (!target) return;

    if (target.kind === "holder") {
      highlightMat.color.set(target.color);
    } else {
      highlightMat.color.set("#ffb060");
      ringMats.forEach((m) => m.color.set("#ff9040"));
    }
  }, [target, locatorKey, highlightMat, ringMats]);

  useEffect(() => {
    if (wasPersisting.current && !highlightPersist && target?.kind === "holder") {
      shrinkFrom.current = Math.max(enlargeRef.current, 0.15);
      shrinkStartMs.current = performance.now();
    }
    wasPersisting.current = highlightPersist;
  }, [highlightPersist, target]);

  useFrame(() => {
    if (!target) {
      shrinkStartMs.current = null;
      dimMat.opacity = 0;
      highlightMat.opacity = 0;
      ringMats.forEach((m) => {
        m.opacity = 0;
      });
      return;
    }

    worldPos.set(...target.position);
    const now = performance.now();
    const pingElapsedMs = now - pingStartMs.current;
    const pingElapsedSec = pingElapsedMs / 1000;
    const showPing = pingElapsedMs <= PING_MS + 100;
    const dim = showPing ? dimOpacity(pingElapsedMs) : 0;

    let enlarge = 0;
    if (target.kind === "holder") {
      if (shrinkStartMs.current !== null) {
        const shrinkT = Math.min(
          1,
          (now - shrinkStartMs.current) / SHRINK_MS,
        );
        enlarge = shrinkFrom.current * (1 - easeInOutCubic(shrinkT));
        if (
          shrinkT >= 1 &&
          !dismissedRef.current &&
          !highlightPersistRef.current
        ) {
          dismissedRef.current = true;
          onHighlightDismissed?.();
        }
      } else if (highlightPersist) {
        const growT = Math.min(1, (now - growStartMs.current) / GROW_MS);
        enlarge = easeOutCubic(growT);
      }
    } else if (showPing) {
      const growT = Math.min(1, pingElapsedMs / GROW_MS);
      enlarge =
        easeOutCubic(growT) * (1 - Math.max(0, (pingElapsedMs - 2600) / 400));
    }

    enlargeRef.current = enlarge;

    const glimmer =
      target.kind === "holder" && enlarge > 0.02
        ? 0.86 +
          0.1 * Math.sin(clock.elapsedTime * 2.1) +
          0.06 * Math.sin(clock.elapsedTime * 3.4 + 1.2)
        : 1;

    if (dimRef.current) {
      dimMat.opacity = dim;
      const dist = 12;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
        camera.quaternion,
      );
      dimRef.current.position
        .copy(camera.position)
        .addScaledVector(forward, dist);
      dimRef.current.quaternion.copy(camera.quaternion);
      const persp = camera as THREE.PerspectiveCamera;
      const vFov = (persp.fov * Math.PI) / 180;
      const height = 2 * Math.tan(vFov / 2) * dist;
      const width = height * persp.aspect;
      dimRef.current.scale.set(width * 1.25, height * 1.25, 1);
      dimRef.current.visible = dim > 0.01;
    }

    if (highlightRef.current) {
      highlightRef.current.position.copy(worldPos);
      highlightRef.current.quaternion.copy(camera.quaternion);

      let worldSize = 8;
      if (target.kind === "holder") {
        worldSize = topTierWorldSize(worldPos, camera, size) * enlarge;
      } else {
        const persp = camera as THREE.PerspectiveCamera;
        const dist = worldPos.distanceTo(camera.position);
        const pixelWorld =
          (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
        const screenPx = 18 + enlarge * 10;
        worldSize = screenPx * pixelWorld * dist * (0.9 + enlarge * 0.35);
      }

      highlightRef.current.scale.setScalar(
        Math.max(0, worldSize) * (0.96 + (glimmer - 0.86) * 0.35),
      );
      highlightMat.opacity =
        target.kind === "holder"
          ? enlarge * (0.72 + (glimmer - 0.86) * 1.8)
          : showPing
            ? enlarge * 0.85
            : 0;
      highlightRef.current.visible = highlightMat.opacity > 0.02;
    }

    for (let i = 0; i < PULSE_COUNT; i++) {
      const ring = ringRefs.current[i];
      const mat = ringMats[i];
      if (!ring) continue;

      const strength = showPing ? pulseStrength(pingElapsedSec, i) : 0;
      if (strength <= 0.01) {
        ring.visible = false;
        mat.opacity = 0;
        continue;
      }

      const progress = Math.min(
        1,
        Math.max(0, (pingElapsedSec - (0.15 + i * 0.75)) / PULSE_DURATION),
      );
      const scale = 0.4 + progress * 5.5;

      ring.position.copy(worldPos);
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(scale);
      mat.opacity = strength;
      ring.visible = true;
    }
  });

  if (!target) return null;

  return (
    <group name="search-locator">
      <mesh
        ref={dimRef}
        material={dimMat}
        renderOrder={50}
        frustumCulled={false}
        visible={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>

      <mesh
        ref={highlightRef}
        material={highlightMat}
        renderOrder={62}
        frustumCulled={false}
        visible={false}
      >
        <planeGeometry args={[1, 1]} />
      </mesh>

      {ringMats.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) ringRefs.current[i] = el;
          }}
          material={mat}
          renderOrder={61}
          frustumCulled={false}
          visible={false}
        >
          <ringGeometry args={[0.55, 0.72, 64]} />
        </mesh>
      ))}
    </group>
  );
}
