import * as THREE from "three";
import {
  createDefaultCamera,
  DEFAULT_CAMERA_POSITION,
} from "./cameraConfig";
import { visualFromHoldings } from "./holderStarVisual";
import {
  OUTER_HOLDER_CAM_DIST_MAX,
  OUTER_HOLDER_CAM_DIST_MIN,
} from "./placeOuterHolderStar";

export const ZOMBIE_LEADERBOARD_STAR_ID = "zombie-leaderboard-star";
export const ZOMBIE_LEADERBOARD_STAR_COLOR = "#7aff7a";
export const ZOMBIE_LEADERBOARD_STAR_SCALE = 3;
export const ZOMBIE_LEADERBOARD_PULSE_SECONDS = 4;

/** Default framing: ~8% from right, ~12% from top. */
const SCREEN_NDC_X = 0.84;
const SCREEN_NDC_Y = 0.76;

const _camera = createDefaultCamera();
const _cameraPos = DEFAULT_CAMERA_POSITION.clone();
const _ndc = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _position = new THREE.Vector3();

function rayFromNdc(ndcX: number, ndcY: number) {
  _ndc.set(ndcX, ndcY, 0.5);
  _ndc.unproject(_camera);
  return _rayDir.copy(_ndc).sub(_cameraPos).normalize();
}

export function zombieLeaderboardStarPosition(): [number, number, number] {
  const dir = rayFromNdc(SCREEN_NDC_X, SCREEN_NDC_Y);
  const midDist =
    (OUTER_HOLDER_CAM_DIST_MIN + OUTER_HOLDER_CAM_DIST_MAX) * 0.5;
  const camDist = midDist - 12;
  _position.copy(_cameraPos).addScaledVector(dir, camDist);
  return [_position.x, _position.y, _position.z];
}

export const ZOMBIE_LEADERBOARD_STAR_POSITION = zombieLeaderboardStarPosition();

export function zombieLeaderboardStarVisual() {
  const rank1 = visualFromHoldings(100, 1, 100, 1);
  const scale = ZOMBIE_LEADERBOARD_STAR_SCALE;

  return {
    coreSize: rank1.coreSize * scale,
    glowSize: rank1.glowSize * scale * 0.75,
    glowOpacity: 0.16,
    sparkle: 0,
    baseBrightness: rank1.brightness * 0.82,
  };
}
