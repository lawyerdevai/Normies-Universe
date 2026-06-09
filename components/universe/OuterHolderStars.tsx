"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OuterHolderStar } from "@/types/universe";

function createOuterStarTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.12, "rgba(255,255,255,0.88)");
  gradient.addColorStop(0.3, "rgba(255,255,255,0.3)");
  gradient.addColorStop(0.55, "rgba(255,255,255,0.07)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface OuterHolderStarsProps {
  stars: OuterHolderStar[];
  pulseWallet: string | null;
  pulseKey: number;
}

export default function OuterHolderStars({
  stars,
  pulseWallet,
  pulseKey,
}: OuterHolderStarsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pulseStart = useRef(0);
  const pulseIndex = useRef(-1);
  const walletIndex = useRef(new Map<string, number>());

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const tex = createOuterStarTexture();
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

    const indexByWallet = new Map<string, number>();
    stars.forEach((star, i) => indexByWallet.set(star.wallet.toLowerCase(), i));
    walletIndex.current = indexByWallet;

    return { geometry: geo, material: mat };
  }, [stars]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.count = stars.length;
    stars.forEach((star, i) => {
      const c = new THREE.Color(star.color[0], star.color[1], star.color[2]);
      c.multiplyScalar(star.opacity);
      mesh.setColorAt(i, c);
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.raycast = () => {};
  }, [stars]);

  useLayoutEffect(() => {
    if (!pulseWallet) return;
    const idx = walletIndex.current.get(pulseWallet.toLowerCase());
    if (idx === undefined) return;
    pulseIndex.current = idx;
    pulseStart.current = performance.now() / 1000;
  }, [pulseWallet, pulseKey]);

  useFrame(({ clock, camera, size }) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const persp = camera as THREE.PerspectiveCamera;
    const pixelWorld = (2 * Math.tan((persp.fov * Math.PI) / 360)) / size.height;
    const camQuat = camera.quaternion;
    const time = clock.elapsedTime;

    let pulseStrength = 0;
    if (pulseIndex.current >= 0) {
      const elapsed = performance.now() / 1000 - pulseStart.current;
      if (elapsed > 1.2) {
        pulseIndex.current = -1;
      } else {
        pulseStrength = Math.sin(Math.min(elapsed / 0.55, 1) * Math.PI);
      }
    }

    for (let i = 0; i < stars.length; i++) {
      const star = stars[i];
      const [x, y, z] = star.position;
      dummy.position.set(x, y, z);
      dummy.quaternion.copy(camQuat);

      const dist = dummy.position.distanceTo(camera.position);
      const twinkle =
        0.9 + 0.1 * Math.sin(time * star.twinkleSpeed + star.twinklePhase);
      let pixels = star.screenPixels * twinkle;

      if (pulseIndex.current === i) {
        pixels *= 1 + pulseStrength * 0.5;
      }

      const worldSize = pixels * pixelWorld * dist;
      dummy.scale.set(worldSize, worldSize, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!stars.length) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, stars.length]}
      frustumCulled={false}
      renderOrder={4}
      raycast={() => null}
    />
  );
}
