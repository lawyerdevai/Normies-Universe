export const GALAXY_ARRIVAL_ACTIVE = "galaxy-arrival-active";

export const GALAXY_ARRIVAL_TRAVEL_SECONDS = 2;
export const GALAXY_ARRIVAL_CAMERA_START_RATIO = 0.35;

export type GalaxyRevealState = {
  active: boolean;
  elapsed: number;
  core: number;
  holders: number;
  arms: number;
  outer: number;
};

export const DEFAULT_GALAXY_REVEAL: GalaxyRevealState = {
  active: false,
  elapsed: 0,
  core: 1,
  holders: 1,
  arms: 1,
  outer: 1,
};

function smoothstep(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

/** Layer opacity ramps from 0→1 across [start, end] seconds. */
export function layerRevealOpacity(
  elapsed: number,
  start: number,
  end: number,
): number {
  if (elapsed <= start) return 0;
  if (elapsed >= end) return 1;
  return smoothstep((elapsed - start) / (end - start));
}

export function computeGalaxyReveal(elapsed: number): Omit<
  GalaxyRevealState,
  "active" | "elapsed"
> {
  return {
    core: layerRevealOpacity(elapsed, 1, 1.5),
    holders: layerRevealOpacity(elapsed, 1, 2),
    arms: layerRevealOpacity(elapsed, 1.5, 3),
    outer: layerRevealOpacity(elapsed, 2, 4),
  };
}
