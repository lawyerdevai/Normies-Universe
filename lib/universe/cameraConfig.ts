import * as THREE from "three";

/** Default framed galaxy composition — loads on every visit. */
export const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0, 48, 155);
export const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
export const DEFAULT_CAMERA_FOV = 50;
export const DEFAULT_CAMERA_NEAR = 0.1;
export const DEFAULT_CAMERA_FAR = 500;

/** Reference viewport for offline screen-projection checks during placement. */
export const DEFAULT_CAMERA_ASPECT = 16 / 9;

export const DEFAULT_CAMERA_DISTANCE = DEFAULT_CAMERA_POSITION.distanceTo(
  DEFAULT_CAMERA_TARGET,
);

/** Zoom in: at most 50% closer than default. */
export const MIN_ORBIT_DISTANCE = DEFAULT_CAMERA_DISTANCE * 0.5;

/** Zoom out: at most 60% further than default. */
export const MAX_ORBIT_DISTANCE = DEFAULT_CAMERA_DISTANCE * 1.6;

/** Polar angle (from +Y) of the default camera — ~72.8°. */
export const DEFAULT_POLAR_ANGLE = Math.acos(
  DEFAULT_CAMERA_POSITION.y / DEFAULT_CAMERA_DISTANCE,
);

/** Vertical tilt clamp: ±20° from default. */
export const POLAR_TILT_CLAMP = (20 * Math.PI) / 180;

export const MIN_POLAR_ANGLE = DEFAULT_POLAR_ANGLE - POLAR_TILT_CLAMP;
export const MAX_POLAR_ANGLE = DEFAULT_POLAR_ANGLE + POLAR_TILT_CLAMP;

export function createDefaultCamera(aspect = DEFAULT_CAMERA_ASPECT) {
  const camera = new THREE.PerspectiveCamera(
    DEFAULT_CAMERA_FOV,
    aspect,
    DEFAULT_CAMERA_NEAR,
    DEFAULT_CAMERA_FAR,
  );
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  camera.lookAt(DEFAULT_CAMERA_TARGET);
  camera.updateMatrixWorld();
  return camera;
}
