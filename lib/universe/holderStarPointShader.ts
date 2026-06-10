import * as THREE from "three";

export const HOLDER_STAR_VERTEX_SHADER = /* glsl */ `
  attribute float aCoreSize;
  attribute float aGlowSize;
  attribute float aGlowOpacity;
  attribute float aBrightness;
  attribute float aSparkle;
  attribute vec3 color;
  uniform float uShowGlow;
  uniform int uHoveredIndex;
  uniform int uSelectedIndex;
  varying float vBrightness;
  varying float vGlow;
  varying float vSparkle;
  varying vec3 vColor;
  varying float vIsSelected;

  void main() {
    vColor = color;
    vSparkle = aSparkle;
    vGlow = aGlowOpacity;
    float hovered = float(gl_VertexID == uHoveredIndex);
    float selected = float(gl_VertexID == uSelectedIndex);
    vIsSelected = selected;
    vBrightness = aBrightness * (1.0 + hovered * 0.14 + selected * 0.05);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    float size = (aCoreSize + aGlowSize * vGlow * uShowGlow) * (1.0 + hovered * 0.06 + selected * 0.03);
    float pixelSize = size * (235.0 / -mvPosition.z);
    gl_PointSize = clamp(pixelSize, 3.0, 88.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const HOLDER_STAR_FRAGMENT_SHADER = /* glsl */ `
  uniform float uShowGlow;
  varying float vBrightness;
  varying float vGlow;
  varying float vSparkle;
  varying vec3 vColor;
  varying float vIsSelected;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);

    if (dist > 0.47) discard;

    float circleMask = 1.0 - smoothstep(0.34, 0.47, dist);
    vec2 skew = vec2(uv.x * 1.08, uv.y * 0.92);

    float core = exp(-length(skew) * length(skew) * 72.0);
    float glow = exp(-dist * dist * mix(10.0, 4.5, vGlow)) * vGlow * 0.62 * uShowGlow;

    float cross = exp(-abs(uv.x) * 36.0) * 0.48 + exp(-abs(uv.y) * 36.0) * 0.48;
    float sparkle = cross * vSparkle * circleMask;

    float alpha = (core * 1.15 + glow + sparkle * 0.52) * vBrightness * circleMask;

    if (vIsSelected > 0.5) {
      float ring = smoothstep(0.38, 0.4, dist) * (1.0 - smoothstep(0.42, 0.44, dist));
      alpha += ring * 0.08 * circleMask;
    }

    if (alpha < 0.001) discard;

    vec3 warm = vec3(
      min(vColor.r * 1.12 + 0.1, 1.0),
      min(vColor.g * 1.06 + 0.07, 1.0),
      vColor.b * 0.84 + 0.03
    );
    vec3 col = warm * (core * 1.35 + glow * 0.5 + sparkle * 0.4 + 0.2);
    gl_FragColor = vec4(col, alpha);
  }
`;

export function createHolderStarPointMaterial(showGlow = true) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uShowGlow: { value: showGlow ? 1 : 0 },
      uHoveredIndex: { value: -1 },
      uSelectedIndex: { value: -1 },
    },
    vertexShader: HOLDER_STAR_VERTEX_SHADER,
    fragmentShader: HOLDER_STAR_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
