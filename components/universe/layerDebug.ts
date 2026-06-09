export type LayerDebugKey =
  | "galaxyAtmosphere"
  | "galaxyBulge"
  | "galaxyArms"
  | "galaxyParticleHalo"
  | "backgroundStars"
  | "backgroundParticleHalo"
  | "holderStarVisible"
  | "holderStarGlow"
  | "holderStarHits"
  | "centralCore"
  | "bloom"
  | "vignette"
  | "fog"
  | "cosmicDust";

export type LayerDebugState = Record<LayerDebugKey, boolean>;

/** Defaults match current production scene appearance. */
export const DEFAULT_LAYER_DEBUG: LayerDebugState = {
  galaxyAtmosphere: true,
  galaxyBulge: true,
  galaxyArms: true,
  galaxyParticleHalo: true,
  backgroundStars: true,
  backgroundParticleHalo: true,
  holderStarVisible: true,
  holderStarGlow: true,
  holderStarHits: true,
  centralCore: true,
  bloom: false,
  vignette: true,
  fog: true,
  cosmicDust: false,
};

export const LAYER_DEBUG_META: {
  key: LayerDebugKey;
  label: string;
  shortcut: string;
  note?: string;
}[] = [
  {
    key: "galaxyAtmosphere",
    label: "Galaxy (all particles)",
    shortcut: "1",
  },
  { key: "galaxyBulge", label: "Galaxy dense bulge", shortcut: "2" },
  { key: "galaxyArms", label: "Galaxy spiral arms", shortcut: "3" },
  {
    key: "galaxyParticleHalo",
    label: "Galaxy particle soft halo",
    shortcut: "4",
    note: "shader falloff only",
  },
  { key: "backgroundStars", label: "Background stars", shortcut: "5" },
  {
    key: "backgroundParticleHalo",
    label: "Background star soft halo",
    shortcut: "6",
    note: "shader falloff only",
  },
  {
    key: "holderStarVisible",
    label: "Holder stars (visible)",
    shortcut: "7",
  },
  {
    key: "holderStarGlow",
    label: "Holder star local glow",
    shortcut: "8",
    note: "shader glow term only",
  },
  {
    key: "holderStarHits",
    label: "Holder star hit targets",
    shortcut: "9",
    note: "invisible; for isolation",
  },
  { key: "centralCore", label: "Central core hit target", shortcut: "0" },
  { key: "bloom", label: "Bloom pass", shortcut: "q" },
  { key: "vignette", label: "Vignette pass", shortcut: "w" },
  { key: "fog", label: "Scene fog", shortcut: "e" },
  {
    key: "cosmicDust",
    label: "CosmicDust (Sparkles haze)",
    shortcut: "r",
    note: "off by default in scene",
  },
];

export function isLayerDebugEnabled() {
  return process.env.NODE_ENV === "development";
}
