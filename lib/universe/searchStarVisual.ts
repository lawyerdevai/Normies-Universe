import * as THREE from "three";

/** ~2s breathing cycle — ±15% size and brightness while panel is open. */
export function searchBreathFactor(elapsedSec: number): number {
  return 1 + 0.15 * Math.sin(elapsedSec * Math.PI);
}

/** Warm-white tone matching top-75 holder star sprites. */
export const HOLDER_SEARCH_WARM = new THREE.Color("#f8edd8");

export function createHolderWarmStarTexture() {
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
