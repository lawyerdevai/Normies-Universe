import { PYRE_RX, PYRE_RY, PYRE_RZ } from "./generatePyre";
import type { StarPlacement } from "./generateStarPositions";
import {
  PYRE_EXCLUSION_MARGIN,
  localToWorldPlacement,
  pyreExclusionWorldMin,
  scaleWorldRadial,
  worldBoundsForRank,
  worldToLocal,
} from "./holderStarBands";

function pyreEllipsoidNorm(lx: number, ly: number, lz: number) {
  return (
    (lx / PYRE_RX) ** 2 + (ly / PYRE_RY) ** 2 + (lz / PYRE_RZ) ** 2
  );
}

const PYRE_LIMIT = PYRE_EXCLUSION_MARGIN * PYRE_EXCLUSION_MARGIN;

/** Push radially outward in world space until the Pyre exclusion zone is cleared. */
function pushWorldOutOfPyre(
  position: [number, number, number],
): [number, number, number] {
  let [lx, ly, lz] = worldToLocal(...position);
  if (pyreEllipsoidNorm(lx, ly, lz) >= PYRE_LIMIT) return position;

  const dist = Math.sqrt(
    position[0] ** 2 + position[1] ** 2 + position[2] ** 2,
  );
  const floor = pyreExclusionWorldMin();
  if (dist < 1e-6) {
    return scaleWorldRadial([1, 0, 0], floor).position;
  }

  let lo = Math.max(dist, floor * 0.5);
  let hi = Math.max(dist * 2.5, floor * 1.5);
  while (hi - lo > 0.05) {
    const mid = (lo + hi) * 0.5;
    const scaled = scaleWorldRadial(position, mid);
    [lx, ly, lz] = worldToLocal(...scaled.position);
    if (pyreEllipsoidNorm(lx, ly, lz) < PYRE_LIMIT) lo = mid;
    else hi = mid;
  }

  return scaleWorldRadial(position, hi).position;
}

/**
 * Hard constraints after clustering / collision nudges:
 * 1) clear Pyre exclusion zone
 * 2) clamp world distance to rank band
 */
export function enforceHolderStarPlacement(
  rank: number,
  placement: StarPlacement,
): StarPlacement {
  const bounds = worldBoundsForRank(rank);
  let position = pushWorldOutOfPyre(placement.position);
  let dist = Math.sqrt(
    position[0] ** 2 + position[1] ** 2 + position[2] ** 2,
  );

  if (dist < bounds.min) {
    position = scaleWorldRadial(position, bounds.min).position;
    dist = bounds.min;
  } else if (dist > bounds.max) {
    position = scaleWorldRadial(position, bounds.max).position;
    dist = bounds.max;
  }

  position = pushWorldOutOfPyre(position);
  dist = Math.sqrt(
    position[0] ** 2 + position[1] ** 2 + position[2] ** 2,
  );

  if (dist < bounds.min) {
    position = scaleWorldRadial(position, bounds.min).position;
  } else if (dist > bounds.max) {
    position = scaleWorldRadial(position, bounds.max).position;
  }

  dist = Math.sqrt(
    position[0] ** 2 + position[1] ** 2 + position[2] ** 2,
  );
  return { position, distanceFromCenter: dist };
}
