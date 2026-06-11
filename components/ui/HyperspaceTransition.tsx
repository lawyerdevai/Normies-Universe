"use client";

import { useEffect, useRef } from "react";

export const STARFORM_HYPERSPACE_ACTIVE = "starform-hyperspace-active";

const DURATION_MS = 3000;
const ACCEL_END_MS = 800;
const CRUISE_END_MS = 2200;
const CROSSFADE_START_MS = 2600;
const MAX_STARS = 420;

const STAR_COLORS = ["#FFFFFF", "#E8F4FF", "#F4F8FF"] as const;

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  brightness: number;
  color: string;
};

type PhaseParams = {
  spawnRate: number;
  speedMult: number;
  drift: number;
  alpha: number;
};

function phaseParams(elapsed: number): PhaseParams {
  if (elapsed < ACCEL_END_MS) {
    const p = elapsed / ACCEL_END_MS;
    return {
      spawnRate: 0.35 + p * 5,
      speedMult: 0.08 + p * 1.1,
      drift: 1.01 + p * 0.018,
      alpha: 1,
    };
  }

  if (elapsed < CRUISE_END_MS) {
    const p = (elapsed - ACCEL_END_MS) / (CRUISE_END_MS - ACCEL_END_MS);
    return {
      spawnRate: 5 + p * 14,
      speedMult: 1.18 + p * 2.6,
      drift: 1.022 + p * 0.012,
      alpha: 1,
    };
  }

  const p = (elapsed - CRUISE_END_MS) / (DURATION_MS - CRUISE_END_MS);
  return {
    spawnRate: 16 * (1 - p) ** 1.5,
    speedMult: 3.78 * (1 - p * 0.93),
    drift: 0.988 - p * 0.012,
    alpha: 1 - p * 0.95,
  };
}

function spawnStar(
  centerX: number,
  centerY: number,
  params: PhaseParams,
): Star {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * 20;
  const speed = (0.5 + Math.random() * 1.6) * params.speedMult;
  const roll = Math.random();

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: roll < 0.55 ? 1.2 + Math.random() * 0.8 : 1.8 + Math.random() * 1.4,
    brightness: 0.35 + Math.random() * 0.55,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]!,
  };
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  star: Star,
  phaseAlpha: number,
) {
  const alpha = star.brightness * phaseAlpha;
  if (alpha <= 0.01) return;

  const glow = star.radius * 2.2;
  const gradient = ctx.createRadialGradient(
    star.x,
    star.y,
    0,
    star.x,
    star.y,
    glow,
  );
  gradient.addColorStop(0, hexWithAlpha(star.color, alpha));
  gradient.addColorStop(0.45, hexWithAlpha(star.color, alpha * 0.35));
  gradient.addColorStop(1, hexWithAlpha(star.color, 0));

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(star.x, star.y, glow, 0, Math.PI * 2);
  ctx.fill();
}

function hexWithAlpha(hex: string, alpha: number) {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`;
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

        const margin = 60;
        if (
          star.x < -margin ||
          star.x > canvas.width + margin ||
          star.y < -margin ||
          star.y > canvas.height + margin
        ) {
          stars.splice(i, 1);
          continue;
        }

        drawStar(ctx, star, params.alpha);
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
