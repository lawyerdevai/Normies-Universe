"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  OUTER_LOCATOR_SCREEN_PX,
  TOP75_LOCATOR_SCALE,
} from "@/lib/universe/resolveSearch";
import type { LocatorTarget } from "@/types/universe";

const DIM_IN_MS = 300;
const ANIM_MS = 3000;
const PULSE_COUNT = 3;
const PULSE_DURATION = 0.85;

interface SearchLocatorProps {
  target: LocatorTarget | null;
  locatorKey: number;
  onScreenPos: (pos: { x: number; y: number } | null) => void;
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

function dimOpacity(elapsedMs: number): number {
  const fadeIn = Math.min(1, elapsedMs / DIM_IN_MS);
  const holdEnd = ANIM_MS - DIM_IN_MS;
  if (elapsedMs <= holdEnd) return easeOutCubic(fadeIn) * 0.6;
  const fadeOut = (elapsedMs - holdEnd) / DIM_IN_MS;
  return (1 - easeOutCubic(Math.min(1, fadeOut))) * 0.6;
}

function enlargeFactor(elapsedMs: number): number {
  const growEnd = 400;
  const shrinkStart = 2600;
  if (elapsedMs < growEnd) return easeOutCubic(elapsedMs / growEnd);
  if (elapsedMs < shrinkStart) return 1;
  const shrink = (elapsedMs - shrinkStart) / 400;
  return 1 - easeOutCubic(Math.min(1, shrink));
}

function pulseStrength(elapsedSec: number, pulseIndex: number): number {
  const start = 0.15 + pulseIndex * 0.75;
  const t = (elapsedSec - start) / PULSE_DURATION;
  if (t < 0 || t > 1) return 0;
  return (1 - t) * (1 - t) * 0.95;
}

export default function SearchLocator({
  target,
  locatorKey,
  onScreenPos,
}: SearchLocatorProps) {
  const { camera, size, gl } = useThree();
  const startMs = useRef(0);
  const projected = useMemo(() => new THREE.Vector3(), []);
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

  useEffect(() => {
    if (!target) {
      onScreenPos(null);
      return;
    }
    startMs.current = performance.now();
    if (target.kind === "holder") {
      highlightMat.color.set(target.color);
    } else {
      highlightMat.color.set("#ffb060");
      ringMats.forEach((m) => m.color.set("#ff9040"));
    }
  }, [target, locatorKey, onScreenPos, highlightMat, ringMats]);

  useFrame(() => {
    if (!target) {
      onScreenPos(null);
      dimMat.opacity = 0;
      highlightMat.opacity = 0;
      ringMats.forEach((m) => {
        m.opacity = 0;
      });
      return;
    }

    worldPos.set(...target.position);
    projected.copy(worldPos).project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    onScreenPos({
      x: rect.left + (projected.x * 0.5 + 0.5) * size.width,
      y: rect.top + (-projected.y * 0.5 + 0.5) * size.height,
    });

    const elapsedMs = performance.now() - startMs.current;
    const showEffects = elapsedMs <= ANIM_MS + 100;
    const elapsedSec = elapsedMs / 1000;
    const dim = showEffects ? dimOpacity(elapsedMs) : 0;
    const enlarge = showEffects ? enlargeFactor(elapsedMs) : 0;

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

      const persp = camera as THREE.PerspectiveCamera;
      const dist = worldPos.distanceTo(camera.position);
      const pixelWorld =
        (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;

      let worldSize = 8;
      if (target.kind === "holder" && target.starKind === "top75") {
        const baseCore = target.baseCoreSize ?? 6;
        const baseGlow = target.baseGlowSize ?? 10;
        const glowOp = target.baseGlowOpacity ?? 0.3;
        const baseWorld = baseCore + baseGlow * glowOp;
        const scaled = baseWorld * (1 + (TOP75_LOCATOR_SCALE - 1) * enlarge);
        const z = Math.max(
          0.1,
          -worldPos.clone().applyMatrix4(camera.matrixWorldInverse).z,
        );
        worldSize = scaled * (235 / z) * pixelWorld * dist;
      } else {
        let screenPx = 14;
        if (target.kind === "holder") {
          const base = target.baseScreenPixels ?? 1.2;
          screenPx = base + (OUTER_LOCATOR_SCREEN_PX - base) * enlarge;
        } else {
          screenPx = 18 + enlarge * 10;
        }
        worldSize = screenPx * pixelWorld * dist * (0.9 + enlarge * 0.35);
      }

      highlightRef.current.scale.setScalar(worldSize);
      highlightMat.opacity = showEffects ? 0.55 + enlarge * 0.45 : 0;
      highlightRef.current.visible = showEffects && highlightMat.opacity > 0.02;
    }

    for (let i = 0; i < PULSE_COUNT; i++) {
      const ring = ringRefs.current[i];
      const mat = ringMats[i];
      if (!ring) continue;

      const strength = showEffects ? pulseStrength(elapsedSec, i) : 0;
      if (strength <= 0.01) {
        ring.visible = false;
        mat.opacity = 0;
        continue;
      }

      const progress = Math.min(
        1,
        Math.max(0, (elapsedSec - (0.15 + i * 0.75)) / PULSE_DURATION),
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
