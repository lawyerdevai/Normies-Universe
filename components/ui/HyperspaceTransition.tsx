"use client";

import { useEffect, useRef } from "react";

export const STARFORM_HYPERSPACE_ACTIVE = "starform-hyperspace-active";

const DURATION_MS = 4000;
const ACCEL_END_MS = 1000;
const PEAK_END_MS = 3000;
const CROSSFADE_START_MS = 3400;
const MAX_STARS = 480;

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
};

type PhaseParams = {
  spawnRate: number;
  speedMult: number;
  drift: number;
  pixelAlpha: number;
};

function phaseParams(elapsed: number): PhaseParams {
  if (elapsed < ACCEL_END_MS) {
    const p = elapsed / ACCEL_END_MS;
    return {
      spawnRate: 0.4 + p * 3.5,
      speedMult: 0.1 + p * 0.85,
      drift: 1.008 + p * 0.015,
      pixelAlpha: 1,
    };
  }

  if (elapsed < PEAK_END_MS) {
    const p = (elapsed - ACCEL_END_MS) / (PEAK_END_MS - ACCEL_END_MS);
    return {
      spawnRate: 3.5 + p * 15,
      speedMult: 0.95 + p * 2.4,
      drift: 1.018 + p * 0.02,
      pixelAlpha: 1,
    };
  }

  const p = (elapsed - PEAK_END_MS) / (DURATION_MS - PEAK_END_MS);
  return {
    spawnRate: 18 * (1 - p) ** 1.6,
    speedMult: 3.35 * (1 - p * 0.9),
    drift: 0.988 - p * 0.015,
    pixelAlpha: 1 - p,
  };
}

function spawnStar(
  centerX: number,
  centerY: number,
  params: PhaseParams,
): Star {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 16;
  const speed = (0.6 + Math.random() * 1.8) * params.speedMult;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: Math.random() < 0.4 ? 4 : 3,
  };
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  star: Star,
  alpha: number,
) {
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = alpha;
  ctx.fillRect(
    star.x - star.size * 0.5,
    star.y - star.size * 0.5,
    star.size,
    star.size,
  );
  ctx.globalAlpha = 1;
}

interface HyperspaceTransitionProps {
  onComplete?: () => void;
}

export default function HyperspaceTransition({
  onComplete,
}: HyperspaceTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayRef.current;
    if (!canvas || !overlay) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const centerX = canvas.width * 0.5;
    const centerY = canvas.height * 0.5;
    const stars: Star[] = [];
    const start = performance.now();
    let raf = 0;
    let done = false;
    let spawnAccumulator = 0;
    let lastFrame = start;

    const tick = (now: number) => {
      if (done) return;

      const elapsed = now - start;
      const dt = Math.min(48, now - lastFrame);
      lastFrame = now;
      const params = phaseParams(elapsed);

      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      spawnAccumulator += params.spawnRate * (dt / 16);
      while (spawnAccumulator >= 1 && stars.length < MAX_STARS) {
        stars.push(spawnStar(centerX, centerY, params));
        spawnAccumulator -= 1;
      }

      for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i]!;
        star.vx *= params.drift;
        star.vy *= params.drift;
        star.x += star.vx * (dt / 16);
        star.y += star.vy * (dt / 16);

        const margin = 80;
        if (
          star.x < -margin ||
          star.x > canvas.width + margin ||
          star.y < -margin ||
          star.y > canvas.height + margin
        ) {
          stars.splice(i, 1);
          continue;
        }

        drawStar(ctx, star, params.pixelAlpha);
      }

      if (elapsed >= CROSSFADE_START_MS) {
        const fade =
          1 - (elapsed - CROSSFADE_START_MS) / (DURATION_MS - CROSSFADE_START_MS);
        overlay.style.opacity = String(Math.max(0, Math.min(1, fade)));
      }

      if (elapsed >= DURATION_MS) {
        done = true;
        overlay.style.opacity = "0";
        onComplete?.();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [onComplete]);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none fixed inset-0 z-[200] bg-black"
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
